/**
 * SuperviseServices — the watchdog brain.
 *
 * Given a list of services with their current health, decide what to do:
 * - healthy → do nothing
 * - degraded → try restart if allowed
 * - dead → escalate to PM
 *
 * Pure logic. No I/O. The caller (supervisor controller) uses IServiceMonitor
 * and IAlertChannel to execute the decisions this function returns.
 *
 * Dependencies: entities + constants only
 */

const { Decision } = require("../entities/decision");
const { Service } = require("../entities/service");
const {
  MAX_RESTARTS_PER_SERVICE,
  RESTART_COOLDOWN_MS,
} = require("../constants");

/**
 * Evaluate a single service and return a decision (or null if no action needed).
 *
 * @param {Service} service - current health snapshot
 * @param {object}  [opts]
 * @param {number}  [opts.maxRestarts]
 * @param {number}  [opts.cooldownMs]
 * @param {string}  [opts.lastRestartAt] - ISO timestamp
 * @returns {{ decision: Decision | null, updatedService: Service }}
 */
function evaluateService(service, opts = {}) {
  const maxRestarts = opts.maxRestarts ?? MAX_RESTARTS_PER_SERVICE;
  const cooldownMs = opts.cooldownMs ?? RESTART_COOLDOWN_MS;

  // Healthy — no action
  if (service.isHealthy()) {
    return { decision: null, updatedService: service };
  }

  // Not restartable (config says no, or no port)
  if (!service.restartEnabled) {
    return {
      decision: new Decision({
        type: "observation",
        target: `service:${service.name}`,
        payload: { status: service.status, action: "skip", reason: "restart disabled" },
        reasoning: `${service.name} is ${service.status} but restart is disabled`,
      }),
      updatedService: service,
    };
  }

  // Exhausted retries → escalate to PM
  if (service.restarts >= maxRestarts) {
    return {
      decision: new Decision({
        type: "escalation",
        target: "pm",
        payload: {
          service: service.name,
          port: service.port,
          status: service.status,
          restarts: service.restarts,
          lastError: service.lastError,
        },
        reasoning: `${service.name} failed ${service.restarts}x (max ${maxRestarts}). Escalating to PM.`,
        confidence: 0.95,
      }),
      updatedService: service.withHealth("dead", service.lastError),
    };
  }

  // Cooldown — don't restart too quickly
  if (opts.lastRestartAt) {
    const elapsed = Date.now() - new Date(opts.lastRestartAt).getTime();
    if (elapsed < cooldownMs) {
      return {
        decision: new Decision({
          type: "observation",
          target: `service:${service.name}`,
          payload: { action: "cooldown", remainingMs: cooldownMs - elapsed },
          reasoning: `${service.name} is ${service.status} but cooldown hasn't elapsed (${Math.round(elapsed / 1000)}s / ${cooldownMs / 1000}s)`,
        }),
        updatedService: service,
      };
    }
  }

  // Attempt restart
  return {
    decision: new Decision({
      type: "action",
      target: `service:${service.name}`,
      payload: {
        action: "restart",
        attempt: service.restarts + 1,
        maxAttempts: maxRestarts,
      },
      reasoning: `${service.name} is ${service.status}. Attempting restart ${service.restarts + 1}/${maxRestarts}.`,
      confidence: 0.7,
    }),
    updatedService: service.withHealth("restarting", service.lastError),
  };
}

/**
 * Evaluate all services. Returns a list of decisions + updated service list.
 *
 * @param {Service[]} services
 * @param {object} [opts] - per-service overrides keyed by service name
 * @returns {{ decisions: Decision[], services: Service[] }}
 */
function superviseAll(services, opts = {}) {
  const decisions = [];
  const updatedServices = [];

  for (const svc of services) {
    const svcOpts = opts[svc.name] || {};
    const { decision, updatedService } = evaluateService(svc, svcOpts);
    if (decision) decisions.push(decision);
    updatedServices.push(updatedService);
  }

  return { decisions, services: updatedServices };
}

/**
 * Detect correlated failures (cascade detection).
 * If 3+ services are down simultaneously, it's likely a systemic issue,
 * not individual service failures.
 *
 * @param {Service[]} services
 * @param {number} [threshold=3]
 * @returns {Decision | null}
 */
function detectCascade(services, threshold = 3) {
  const down = services.filter(s => s.needsAttention());
  if (down.length >= threshold) {
    return new Decision({
      type: "escalation",
      target: "pm",
      payload: {
        action: "cascade_alert",
        downCount: down.length,
        services: down.map(s => ({ name: s.name, status: s.status, error: s.lastError })),
      },
      reasoning: `${down.length} services down simultaneously (threshold: ${threshold}). Possible systemic failure.`,
      confidence: 0.9,
    });
  }
  return null;
}

module.exports = { evaluateService, superviseAll, detectCascade };
