const { describe, it } = require("node:test");
const assert = require("node:assert");
const { routeInput } = require("./route_input");
const { Input } = require("../entities/input");

function msg(text, opts = {}) {
  return new Input({
    type: "message",
    source: opts.source || "whatsapp",
    sender: opts.sender || "+91test",
    payload: text,
    priority: opts.priority || "normal",
  });
}

describe("route_input", () => {
  // ─── T1: Direct commands ───

  it("routes /status to T1 service_health", () => {
    const r = routeInput(msg("/status"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "service_health");
  });

  it("routes /plan to T1 plan_summary", () => {
    const r = routeInput(msg("/plan"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "plan_summary");
  });

  it("routes /know search term to T1 knowledge_search with args", () => {
    const r = routeInput(msg("/know ollama models"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "knowledge_search");
    assert.strictEqual(r.params.args, "ollama models");
  });

  it("routes /help to T1 help", () => {
    const r = routeInput(msg("/help"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "help");
  });

  // ─── T1: Focus commands ───

  it("routes 'done raj-sadan-master-plan:D0-T1' to T1 focus_command", () => {
    const r = routeInput(msg("done raj-sadan-master-plan:D0-T1"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "focus_command");
    assert.strictEqual(r.params.command, "done raj-sadan-master-plan:D0-T1");
  });

  it("routes 'skip' to T1 focus_command", () => {
    const r = routeInput(msg("skip"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "focus_command");
  });

  // ─── T3: Explicit escalation ───

  it("routes /mrv to T3 escalate_explicit", () => {
    const r = routeInput(msg("/mrv fix the cron service"));
    assert.strictEqual(r.tier, "T3");
    assert.strictEqual(r.handler, "escalate_explicit");
    assert.strictEqual(r.params.text, "fix the cron service");
  });

  it("routes /urgent to T3", () => {
    const r = routeInput(msg("/urgent server is down"));
    assert.strictEqual(r.tier, "T3");
    assert.strictEqual(r.handler, "escalate_explicit");
  });

  it("routes /deploy to T3 deploy_minister", () => {
    const r = routeInput(msg("/deploy review check the PR"));
    assert.strictEqual(r.tier, "T3");
    assert.strictEqual(r.handler, "deploy_minister");
  });

  // ─── T2: Minister routing ───

  it("routes @planning to T2 minister_chat", () => {
    const r = routeInput(msg("@planning design the new API"));
    assert.strictEqual(r.tier, "T2");
    assert.strictEqual(r.handler, "minister_chat");
    assert.strictEqual(r.params.minister, "planning");
    assert.strictEqual(r.params.text, "design the new API");
  });

  it("routes @review to T2 minister_chat", () => {
    const r = routeInput(msg("@review check the migration"));
    assert.strictEqual(r.tier, "T2");
    assert.strictEqual(r.handler, "minister_chat");
    assert.strictEqual(r.params.minister, "review");
  });

  // ─── T1: @cortex commands ───

  it("routes @cortex to T1 cortex_command", () => {
    const r = routeInput(msg("@cortex restart whatsapp"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "cortex_command");
    assert.strictEqual(r.params.command, "restart whatsapp");
  });

  // ─── Urgent priority override ───

  it("urgent priority always routes to T3", () => {
    const r = routeInput(msg("just a normal question", { priority: "urgent" }));
    assert.strictEqual(r.tier, "T3");
    assert.strictEqual(r.handler, "escalate_urgent");
  });

  // ─── Default: T2 smart triage ───

  it("routes unrecognized text to T2 smart_triage", () => {
    const r = routeInput(msg("what's the weather like?"));
    assert.strictEqual(r.tier, "T2");
    assert.strictEqual(r.handler, "smart_triage");
  });

  it("routes conversational text to T2 smart_triage", () => {
    const r = routeInput(msg("tell me about the system architecture"));
    assert.strictEqual(r.tier, "T2");
    assert.strictEqual(r.handler, "smart_triage");
  });

  // ─── Edge cases ───

  it("handles empty payload as T1 passthrough", () => {
    const r = routeInput(msg(""));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "empty");
  });

  it("handles non-message input as T1 passthrough", () => {
    const input = new Input({ type: "health", source: "cron", sender: "system", payload: {} });
    const r = routeInput(input);
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "passthrough");
  });

  it("handles null input gracefully", () => {
    const r = routeInput(null);
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "passthrough");
  });

  // ─── Case insensitivity ───

  it("matches /STATUS case-insensitively", () => {
    const r = routeInput(msg("/STATUS"));
    assert.strictEqual(r.tier, "T1");
    assert.strictEqual(r.handler, "service_health");
  });

  it("matches @PLANNING case-insensitively", () => {
    const r = routeInput(msg("@PLANNING build roadmap"));
    assert.strictEqual(r.tier, "T2");
    assert.strictEqual(r.handler, "minister_chat");
    assert.strictEqual(r.params.minister, "planning");
  });
});
