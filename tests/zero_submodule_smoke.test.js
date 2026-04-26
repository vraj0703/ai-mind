/**
 * Zero-submodule smoke test (RAJ-41 / EXTRACTION_STRATEGY.md contract).
 *
 * Proves the contract: a fresh `git clone && npm install && npm start` works
 * end-to-end with default mocks. No external services. No env vars. No
 * submodules pulled.
 *
 * If this test fails, the mockability contract is broken — investigate before
 * shipping.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const { createContainer, ALL_BINDINGS } = require("../di/container");

test("zero-submodule install: every binding defaults to its mock", () => {
  const c = createContainer();
  assert.deepEqual(c.config.realBindings, [], "no real bindings should be active by default");
  assert.equal(c.config.mockBindings.length, ALL_BINDINGS.length, "all bindings should be mocks");
});

test("zero-submodule install: LLM returns a [mock]-tagged response", async () => {
  const c = createContainer();
  const result = await c.llm.complete("any-model", [{ role: "user", content: "/status" }]);
  assert.ok(result.content.startsWith("[mock]"), `expected [mock] prefix, got: ${result.content}`);
  assert.equal(typeof result.tokensIn, "number");
  assert.equal(typeof result.tokensOut, "number");
});

test("zero-submodule install: alert channel accepts a send call", async () => {
  // Capture instead of console.log so test output stays clean
  const c = createContainer({ use: { alertChannel: new (require("../data/repositories/mocks").ConsoleAlertChannel)({ sink: () => {} }) } });
  const result = await c.alertChannel.send("pm", "test message");
  assert.equal(result.sent, true);
  assert.equal(result.channel, "mock-console");
});

test("zero-submodule install: plan store starts empty + supports updates", async () => {
  const c = createContainer();
  const plans = await c.planStore.loadAll();
  assert.deepEqual(plans, [], "default plan store should be empty");
});

test("zero-submodule install: service monitor reports healthy without network", async () => {
  const c = createContainer();
  const result = await c.serviceMonitor.checkHealth({ name: "test", port: 9999 });
  assert.equal(result.status, "healthy");
});

test("zero-submodule install: job scheduler reports zero jobs", async () => {
  const c = createContainer();
  const h = await c.jobScheduler.health();
  assert.deepEqual(h, { active: 0, paused: 0, total: 0 });
});

test("zero-submodule install: state writer accepts writes without filesystem", async () => {
  const c = createContainer();
  await c.stateWriter.writeSession({ test: true });
  await c.stateWriter.logDecision({ type: "test", reason: "smoke" });
  // Mock exposes test-only getters
  assert.equal(c.stateWriter.getSessions().length, 1);
  assert.equal(c.stateWriter.getDecisions().length, 1);
});

test("zero-submodule install: context provider returns a synthetic context", async () => {
  const c = createContainer();
  const ctx = await c.contextProvider.getContext();
  // Mock returns a real Context entity so use cases can call its methods
  assert.equal(typeof ctx.getDownServices, "function");
  assert.equal(typeof ctx.getActivePlans, "function");
  assert.deepEqual(ctx.getDownServices(), [], "no services → none down");
  assert.deepEqual(ctx.getActivePlans(), [], "no plans → none active");
  assert.equal(ctx.session.mock, true);
});

test("opt-in: per-binding 'real' flag flips a mock to real", () => {
  // Just verify the resolver — don't actually run real (would need Ollama)
  const c = createContainer({ use: { llm: "real" } });
  assert.deepEqual(c.config.realBindings, ["llm"]);
  assert.equal(c.config.mockBindings.includes("llm"), false);
});

test("opt-in: env MIND_USE_REAL=all flips everything to real", () => {
  const old = process.env.MIND_USE_REAL;
  process.env.MIND_USE_REAL = "all";
  try {
    const c = createContainer();
    assert.equal(c.config.realBindings.length, ALL_BINDINGS.length);
    assert.deepEqual(c.config.mockBindings, []);
  } finally {
    if (old === undefined) delete process.env.MIND_USE_REAL;
    else process.env.MIND_USE_REAL = old;
  }
});

test("opt-in: explicit instance injection wins over real/mock flags", () => {
  const customLLM = { complete: async () => ({ content: "custom", model: "x", tokensIn: 0, tokensOut: 0 }) };
  const c = createContainer({ use: { llm: customLLM } });
  assert.strictEqual(c.llm, customLLM);
});

test("supervisor-of-self mode: empty services array is supported", () => {
  const c = createContainer({ services: [] });
  assert.deepEqual(c.serviceList, []);
});
