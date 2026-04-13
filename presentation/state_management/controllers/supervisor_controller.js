/**
 * SupervisorController — the 60-second watchdog loop.
 *
 * Replaces cortex's 85KB monolith with a clean controller that
 * composes domain use cases + repository interfaces.
 */

const { superviseAll, detectCascade } = require("../../../domain/use_cases/supervise_services");
const { findNextTasks } = require("../../../domain/use_cases/evaluate_plans");
const { executeDecision } = require("../../../domain/use_cases/execute_decision");
const { escalateToPM } = require("../../../domain/use_cases/escalate");
const C = require("../../../domain/constants");

class SupervisorController {
  /**
   * @param {object} deps - from DI container
   */
  constructor(deps) {
    this.contextProvider = deps.contextProvider;
    this.serviceMonitor = deps.serviceMonitor;
    this.stateWriter = deps.stateWriter;
    this.alertChannel = deps.alertChannel;
    this.planStore = deps.planStore;
    this.serviceList = deps.serviceList;

    this._interval = null;
    this._loopCount = 0;
    this._startedAt = new Date().toISOString();
    this._sessionId = `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 5)}`;
    this._lastRestarts = {};      // serviceName → ISO timestamp
    this._recentDecisions = [];
    this._running = false;
  }

  start(intervalMs = C.WATCHDOG_INTERVAL_MS) {
    if (this._running) return;
    this._running = true;
    console.log(`[supervisor] started — session ${this._sessionId}, loop every ${intervalMs / 1000}s`);

    // Run immediately, then on interval
    this.tick().catch(err => console.error("[supervisor] tick error:", err.message));
    this._interval = setInterval(() => {
      this.tick().catch(err => console.error("[supervisor] tick error:", err.message));
    }, intervalMs);
  }

  stop() {
    this._running = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    console.log(`[supervisor] stopped after ${this._loopCount} loops`);
  }

  async tick() {
    this._loopCount++;
    const now = Date.now();

    // ─── Phase 1: Health check all services ───
    const services = await this.serviceMonitor.checkAll(this.serviceList);
    this.serviceList = services; // update in-place for next tick

    // ─── Phase 2: Watchdog decisions ───
    const perServiceOpts = {};
    for (const svc of services) {
      perServiceOpts[svc.name] = {
        lastRestartAt: this._lastRestarts[svc.name] || null,
      };
    }
    const { decisions, services: updatedServices } = superviseAll(services, perServiceOpts);
    this.serviceList = updatedServices;

    // Execute watchdog decisions
    const execDeps = {
      alertChannel: this.alertChannel,
      serviceMonitor: this.serviceMonitor,
      stateWriter: this.stateWriter,
      planStore: this.planStore,
    };

    for (const d of decisions) {
      const result = await executeDecision(d, execDeps);
      if (d.payload?.action === "restart") {
        this._lastRestarts[d.target.replace("service:", "")] = new Date().toISOString();
        // ─── Self-healing: notify senses to observe the outcome ───
        this._notifySensesOutcome(d);
      }
      this._recentDecisions.unshift({ ...d.toLogEntry(), result });
      if (this._recentDecisions.length > C.MAX_DECISIONS_IN_MEMORY) {
        this._recentDecisions.length = C.MAX_DECISIONS_IN_MEMORY;
      }
    }

    // ─── Phase 3: Cascade detection ───
    const cascade = detectCascade(updatedServices);
    if (cascade) {
      await executeDecision(cascade, execDeps);
      this._recentDecisions.unshift(cascade.toLogEntry());
    }

    // ─── Phase 4: Session state write (every tick) ───
    const uptimeMinutes = Math.floor((now - new Date(this._startedAt).getTime()) / 60_000);
    const alerts = updatedServices.filter(s => s.isDead()).map(s => `${s.name} is DOWN`);
    await this.stateWriter.writeSession({
      sessionId: this._sessionId,
      startedAt: this._startedAt,
      cleanShutdown: false,
      uptimeMinutes,
      alerts,
      services: updatedServices,
    });

    // ─── Phase 5: Heartbeat (every 5th tick) ───
    if (this._loopCount % 5 === 0) {
      await this.stateWriter.writeHeartbeat({
        uptimeMinutes,
        loopCount: this._loopCount,
        servicesHealthy: updatedServices.filter(s => s.isHealthy()).length,
        servicesTotal: updatedServices.length,
      });
    }

    // ─── Phase 6: Plan evaluation (every 5th tick) ───
    if (this._loopCount % 5 === 0) {
      try {
        const plans = await this.planStore.loadAll();
        const nextTasks = findNextTasks(plans, { minScore: C.MIN_TASK_SCORE_FOR_EXECUTION });
        // Log what's available (execution is deferred to cortex/sherpa integration)
        if (nextTasks.length > 0) {
          const logEntry = {
            type: "observation",
            target: "service:planner",
            payload: {
              action: "tasks_available",
              tasks: nextTasks.map(t => ({ plan: t.planId, task: t.task.id, score: t.task.score })),
            },
            reasoning: `${nextTasks.length} task(s) ready for execution`,
          };
          this._recentDecisions.unshift({ ...logEntry, timestamp: new Date().toISOString() });
        }
      } catch { /* plan eval failure is non-fatal */ }
    }
  }

  /**
   * Self-healing feedback loop: after a restart decision, tell senses
   * to check back in 30s and report whether the restart actually worked.
   */
  _notifySensesOutcome(decision) {
    const sensesUrl = this._sensesObserveUrl || "http://127.0.0.1:3487/observe";
    fetch(sensesUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(decision.toLogEntry()),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Senses might not be running — non-fatal
    });
  }

  getStatus() {
    return {
      sessionId: this._sessionId,
      startedAt: this._startedAt,
      loopCount: this._loopCount,
      running: this._running,
      uptimeMinutes: Math.floor((Date.now() - new Date(this._startedAt).getTime()) / 60_000),
      services: this.serviceList.map(s => ({
        name: s.name, port: s.port, status: s.status, restarts: s.restarts,
      })),
      recentDecisions: this._recentDecisions.slice(0, 10),
    };
  }
}

module.exports = { SupervisorController };
