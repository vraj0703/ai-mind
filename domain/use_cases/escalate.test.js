const { describe, it } = require("node:test");
const assert = require("node:assert");
const { escalateToMrV, escalateToPM, isMrVOffline, selectAutoResponses } = require("./escalate");
const { Input } = require("../entities/input");

function msg(text) {
  return new Input({ type: "message", source: "whatsapp", sender: "+91test", payload: text });
}

describe("escalate", () => {

  describe("escalateToMrV", () => {
    it("creates an escalation decision targeting mr-v", () => {
      const input = msg("complex question about architecture");
      const d = escalateToMrV(input, "T2 triage determined this needs Claude");

      assert.strictEqual(d.type, "escalation");
      assert.strictEqual(d.target, "mr-v");
      assert.strictEqual(d.inputId, input.id);
      assert.ok(d.payload.originalInput.text.includes("architecture"));
      assert.ok(d.reasoning.includes("Mr. V"));
    });

    it("preserves the original input metadata", () => {
      const input = msg("help me");
      const d = escalateToMrV(input, "test");

      assert.strictEqual(d.payload.originalInput.source, "whatsapp");
      assert.strictEqual(d.payload.originalInput.sender, "+91test");
      assert.strictEqual(d.payload.originalInput.id, input.id);
    });

    it("accepts priority parameter", () => {
      const d = escalateToMrV(msg("urgent"), "test", "urgent");
      assert.strictEqual(d.payload.priority, "urgent");
    });
  });

  describe("escalateToPM", () => {
    it("creates an escalation decision targeting pm", () => {
      const d = escalateToPM("WhatsApp is DOWN", { service: "whatsapp", restarts: 3 });

      assert.strictEqual(d.type, "escalation");
      assert.strictEqual(d.target, "pm");
      assert.ok(d.payload.subject.includes("DOWN"));
      assert.strictEqual(d.confidence, 0.95);
    });

    it("defaults to whatsapp channel", () => {
      const d = escalateToPM("test", {});
      assert.strictEqual(d.payload.channel, "whatsapp");
    });

    it("accepts custom channel", () => {
      const d = escalateToPM("test", {}, "sms");
      assert.strictEqual(d.payload.channel, "sms");
    });
  });

  describe("isMrVOffline", () => {
    it("returns true when lastActivity is null", () => {
      assert.strictEqual(isMrVOffline(null), true);
    });

    it("returns false when activity was recent", () => {
      assert.strictEqual(isMrVOffline(new Date().toISOString()), false);
    });

    it("returns true when activity was long ago", () => {
      const longAgo = new Date(Date.now() - 3_600_000).toISOString(); // 1 hour ago
      assert.strictEqual(isMrVOffline(longAgo, 1_800_000), true); // 30 min threshold
    });

    it("returns false when activity is within threshold", () => {
      const recent = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
      assert.strictEqual(isMrVOffline(recent, 1_800_000), false);
    });

    it("respects custom threshold", () => {
      const fiveMinAgo = new Date(Date.now() - 300_000).toISOString();
      assert.strictEqual(isMrVOffline(fiveMinAgo, 60_000), true);  // 1 min threshold
      assert.strictEqual(isMrVOffline(fiveMinAgo, 600_000), false); // 10 min threshold
    });
  });

  describe("selectAutoResponses", () => {
    const items = [
      { id: "1", status: "pending" },
      { id: "2", status: "pending" },
      { id: "3", status: "pending" },
      { id: "4", status: "responded" },
    ];

    it("returns empty when Mr. V is online", () => {
      const result = selectAutoResponses(items, new Date().toISOString());
      assert.strictEqual(result.length, 0);
    });

    it("returns pending items when Mr. V is offline", () => {
      const result = selectAutoResponses(items, null);
      assert.ok(result.length > 0);
      assert.ok(result.every(r => r.status === "pending"));
    });

    it("respects maxPerTick rate limit", () => {
      const result = selectAutoResponses(items, null, 2);
      assert.strictEqual(result.length, 2);
    });

    it("skips non-pending items", () => {
      const result = selectAutoResponses(items, null, 10);
      assert.strictEqual(result.length, 3); // 3 pending, 1 responded
    });
  });
});
