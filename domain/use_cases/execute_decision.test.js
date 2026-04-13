const { describe, it } = require("node:test");
const assert = require("node:assert");
const { executeDecision } = require("./execute_decision");
const { Decision } = require("../entities/decision");

// ─── Mock repositories ───

class MockAlertChannel {
  constructor(opts = {}) {
    this.available = opts.available !== false;
    this.sent = [];
    this.shouldFail = opts.shouldFail || false;
  }
  async isAvailable() { return this.available; }
  async send(target, message, priority) {
    if (this.shouldFail) throw new Error("channel down");
    this.sent.push({ target, message, priority });
    return { sent: true, channel: "mock" };
  }
}

class MockServiceMonitor {
  constructor(opts = {}) {
    this.restartCalls = [];
    this.shouldFail = opts.shouldFail || false;
  }
  async restart(service) {
    if (this.shouldFail) throw new Error("restart failed");
    this.restartCalls.push(service);
    return { success: true };
  }
  async checkHealth() { return { status: "healthy" }; }
  async checkAll(services) { return services; }
}

class MockStateWriter {
  constructor() { this.logged = []; }
  async writeSession() {}
  async writeHeartbeat() {}
  async logDecision(d) { this.logged.push(d); }
}

class MockPlanStore {
  constructor() { this.updates = []; }
  async loadAll() { return []; }
  async loadById() { return null; }
  async updateTaskStatus(planId, taskId, status) {
    this.updates.push({ planId, taskId, status });
    return true;
  }
}

function deps(overrides = {}) {
  return {
    alertChannel: overrides.alertChannel || new MockAlertChannel(),
    serviceMonitor: overrides.serviceMonitor || new MockServiceMonitor(),
    stateWriter: overrides.stateWriter || new MockStateWriter(),
    planStore: overrides.planStore || new MockPlanStore(),
  };
}

describe("execute_decision", () => {

  // ─── Response ───

  it("sends response decisions via alert channel", async () => {
    const alert = new MockAlertChannel();
    const d = new Decision({ type: "response", target: "whatsapp", payload: "Hello PM" });
    const result = await executeDecision(d, deps({ alertChannel: alert }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, "response_sent");
    assert.strictEqual(alert.sent.length, 1);
    assert.strictEqual(alert.sent[0].message, "Hello PM");
  });

  it("handles alert channel failure gracefully", async () => {
    const alert = new MockAlertChannel({ shouldFail: true });
    const d = new Decision({ type: "response", target: "whatsapp", payload: "test" });
    const result = await executeDecision(d, deps({ alertChannel: alert }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.action, "response_failed");
    assert.ok(result.error.includes("channel down"));
  });

  // ─── Action: service restart ───

  it("restarts service for action decisions", async () => {
    const monitor = new MockServiceMonitor();
    const d = new Decision({
      type: "action",
      target: "service:whatsapp",
      payload: { action: "restart", attempt: 1 },
    });
    const result = await executeDecision(d, deps({ serviceMonitor: monitor }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, "service_restart");
    assert.strictEqual(monitor.restartCalls[0].name, "whatsapp");
  });

  it("handles restart failure", async () => {
    const monitor = new MockServiceMonitor({ shouldFail: true });
    const d = new Decision({
      type: "action",
      target: "service:cron",
      payload: { action: "restart" },
    });
    const result = await executeDecision(d, deps({ serviceMonitor: monitor }));

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.action, "restart_failed");
  });

  // ─── Action: task update ───

  it("updates task status for update_task actions", async () => {
    const planStore = new MockPlanStore();
    const d = new Decision({
      type: "action",
      target: "service:planner",
      payload: { action: "update_task", planId: "master", taskId: "T1", newStatus: "done" },
    });
    const result = await executeDecision(d, deps({ planStore }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, "task_updated");
    assert.strictEqual(planStore.updates[0].planId, "master");
    assert.strictEqual(planStore.updates[0].taskId, "T1");
  });

  // ─── Escalation ───

  it("sends escalation via alert channel with urgent priority", async () => {
    const alert = new MockAlertChannel();
    const d = new Decision({
      type: "escalation",
      target: "pm",
      payload: { subject: "WhatsApp DOWN", details: { restarts: 3 } },
      reasoning: "Service exhausted retries",
    });
    const result = await executeDecision(d, deps({ alertChannel: alert }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, "escalation_sent");
    assert.strictEqual(alert.sent[0].priority, "urgent");
    assert.strictEqual(alert.sent[0].target, "pm");
  });

  // ─── Observation ───

  it("logs observation without side effects", async () => {
    const writer = new MockStateWriter();
    const d = new Decision({
      type: "observation",
      target: "service:cron",
      payload: { action: "cooldown" },
    });
    const result = await executeDecision(d, deps({ stateWriter: writer }));

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.action, "logged_observation");
    assert.strictEqual(writer.logged.length, 1);
  });

  // ─── Logging ───

  it("always logs the decision regardless of type", async () => {
    const writer = new MockStateWriter();
    const d = new Decision({ type: "response", target: "dashboard", payload: "test" });
    await executeDecision(d, deps({ stateWriter: writer }));

    assert.strictEqual(writer.logged.length, 1);
    assert.strictEqual(writer.logged[0].id, d.id);
  });

  it("doesn't crash when logging fails", async () => {
    const writer = { logDecision: async () => { throw new Error("disk full"); }, writeSession: async () => {}, writeHeartbeat: async () => {} };
    const d = new Decision({ type: "observation", target: "service:x", payload: {} });
    const result = await executeDecision(d, deps({ stateWriter: writer }));

    assert.strictEqual(result.success, true); // observation still succeeds
  });

  // ─── Unknown type ───

  it("returns error for unknown decision type", async () => {
    // Bypass validation by directly setting type
    const d = new Decision({ type: "response", target: "dashboard", payload: "x" });
    d.type = "alien";
    const result = await executeDecision(d, deps());

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes("alien"));
  });
});
