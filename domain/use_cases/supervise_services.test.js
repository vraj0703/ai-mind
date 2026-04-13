const { describe, it } = require("node:test");
const assert = require("node:assert");
const { evaluateService, superviseAll, detectCascade } = require("./supervise_services");
const { Service } = require("../entities/service");

function svc(name, overrides = {}) {
  return new Service({ name, port: 3000 + Math.floor(Math.random() * 1000), ...overrides });
}

describe("supervise_services", () => {

  // ─── evaluateService ───

  describe("evaluateService", () => {
    it("returns null decision for healthy service", () => {
      const s = svc("test", { status: "healthy" });
      const { decision } = evaluateService(s);
      assert.strictEqual(decision, null);
    });

    it("returns restart decision for degraded service", () => {
      const s = svc("whatsapp", { status: "degraded", port: 3478 });
      const { decision, updatedService } = evaluateService(s);
      assert.strictEqual(decision.type, "action");
      assert.strictEqual(decision.payload.action, "restart");
      assert.strictEqual(decision.payload.attempt, 1);
      assert.strictEqual(updatedService.status, "restarting");
    });

    it("escalates to PM after max restarts exhausted", () => {
      const s = svc("cron", { status: "dead", port: 3479, restarts: 3 });
      const { decision } = evaluateService(s);
      assert.strictEqual(decision.type, "escalation");
      assert.strictEqual(decision.target, "pm");
      assert.ok(decision.reasoning.includes("3x"));
    });

    it("skips restart when restart is disabled", () => {
      const s = svc("content-engine", { status: "dead", port: 3480, restartEnabled: false });
      const { decision } = evaluateService(s);
      assert.strictEqual(decision.type, "observation");
      assert.ok(decision.reasoning.includes("disabled"));
    });

    it("respects cooldown period", () => {
      const s = svc("brain", { status: "degraded", port: 3483 });
      const { decision } = evaluateService(s, {
        lastRestartAt: new Date().toISOString(), // just now
        cooldownMs: 120_000,
      });
      assert.strictEqual(decision.type, "observation");
      assert.ok(decision.payload.action === "cooldown");
    });

    it("allows restart after cooldown elapsed", () => {
      const s = svc("brain", { status: "degraded", port: 3483 });
      const pastTime = new Date(Date.now() - 200_000).toISOString(); // 200s ago
      const { decision } = evaluateService(s, {
        lastRestartAt: pastTime,
        cooldownMs: 120_000,
      });
      assert.strictEqual(decision.type, "action");
      assert.strictEqual(decision.payload.action, "restart");
    });

    it("increments restart count on restart decision", () => {
      const s = svc("wa", { status: "dead", port: 3478, restarts: 1 });
      const { decision, updatedService } = evaluateService(s);
      assert.strictEqual(decision.payload.attempt, 2);
      assert.strictEqual(updatedService.restarts, 2);
    });

    it("custom maxRestarts overrides default", () => {
      const s = svc("test", { status: "dead", restarts: 1 });
      const { decision } = evaluateService(s, { maxRestarts: 1 });
      assert.strictEqual(decision.type, "escalation");
    });
  });

  // ─── superviseAll ───

  describe("superviseAll", () => {
    it("returns empty decisions for all-healthy services", () => {
      const services = [
        svc("a", { status: "healthy" }),
        svc("b", { status: "healthy" }),
      ];
      const { decisions } = superviseAll(services);
      assert.strictEqual(decisions.length, 0);
    });

    it("returns restart decisions for unhealthy services", () => {
      const services = [
        svc("a", { status: "healthy" }),
        svc("b", { status: "degraded" }),
        svc("c", { status: "dead" }),
      ];
      const { decisions } = superviseAll(services);
      assert.strictEqual(decisions.length, 2);
      assert.ok(decisions.every(d => d.type === "action"));
    });

    it("passes per-service opts correctly", () => {
      const services = [
        svc("a", { status: "dead", restarts: 5 }),
      ];
      const { decisions } = superviseAll(services, { a: { maxRestarts: 5 } });
      assert.strictEqual(decisions[0].type, "escalation");
    });

    it("returns updated services with new statuses", () => {
      const services = [
        svc("a", { status: "degraded" }),
      ];
      const { services: updated } = superviseAll(services);
      assert.strictEqual(updated[0].status, "restarting");
    });
  });

  // ─── detectCascade ───

  describe("detectCascade", () => {
    it("returns null when fewer than threshold services are down", () => {
      const services = [
        svc("a", { status: "dead" }),
        svc("b", { status: "healthy" }),
        svc("c", { status: "healthy" }),
      ];
      const d = detectCascade(services, 3);
      assert.strictEqual(d, null);
    });

    it("returns escalation when threshold reached", () => {
      const services = [
        svc("a", { status: "dead" }),
        svc("b", { status: "degraded" }),
        svc("c", { status: "dead" }),
      ];
      const d = detectCascade(services, 3);
      assert.strictEqual(d.type, "escalation");
      assert.strictEqual(d.target, "pm");
      assert.strictEqual(d.payload.downCount, 3);
    });

    it("counts degraded as needing attention", () => {
      const services = [
        svc("a", { status: "degraded" }),
        svc("b", { status: "degraded" }),
        svc("c", { status: "degraded" }),
      ];
      const d = detectCascade(services, 3);
      assert.ok(d !== null);
    });

    it("respects custom threshold", () => {
      const services = [
        svc("a", { status: "dead" }),
        svc("b", { status: "dead" }),
      ];
      assert.strictEqual(detectCascade(services, 3), null);
      assert.ok(detectCascade(services, 2) !== null);
    });
  });
});
