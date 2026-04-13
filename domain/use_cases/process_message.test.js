const { describe, it } = require("node:test");
const assert = require("node:assert");
const { processT2Message, assessComplexity, buildSystemPrompt } = require("./process_message");
const { Input } = require("../entities/input");
const { Context } = require("../entities/context");
const { Service } = require("../entities/service");
const { Plan } = require("../entities/plan");

// Mock LLM provider
class MockLLM {
  constructor(opts = {}) {
    this.available = opts.available !== false;
    this.response = opts.response || "mock response";
    this.calls = [];
  }
  async isAvailable() { return this.available; }
  async complete(model, messages, options) {
    this.calls.push({ model, messages, options });
    return { content: this.response, model, tokensIn: 10, tokensOut: 20 };
  }
  async listModels() { return ["mock-model"]; }
}

function msg(text) {
  return new Input({ type: "message", source: "whatsapp", sender: "+91test", payload: text });
}

describe("process_message", () => {

  describe("processT2Message", () => {
    it("calls LLM and returns a response Decision", async () => {
      const llm = new MockLLM({ response: "Hello from LLM" });
      const input = msg("what is the system status?");
      const context = new Context();
      const route = { tier: "T2", handler: "smart_triage", params: { text: "what is the system status?" } };

      const decision = await processT2Message({ input, context, route, llm });

      assert.strictEqual(decision.type, "response");
      assert.strictEqual(decision.target, "whatsapp");
      assert.strictEqual(decision.payload, "Hello from LLM");
      assert.strictEqual(decision.inputId, input.id);
      assert.ok(decision.tokens);
      assert.strictEqual(llm.calls.length, 1);
    });

    it("throws LLMUnavailableError when LLM is down", async () => {
      const llm = new MockLLM({ available: false });
      const input = msg("test");
      const context = new Context();
      const route = { tier: "T2", handler: "smart_triage", params: {} };

      await assert.rejects(
        () => processT2Message({ input, context, route, llm }),
        { name: "LLMUnavailableError" }
      );
    });

    it("uses lower temperature for minister chat", async () => {
      const llm = new MockLLM();
      const input = msg("review this code");
      const context = new Context();
      const route = { tier: "T2", handler: "minister_chat", params: { minister: "review", text: "review this code" } };

      await processT2Message({ input, context, route, llm });

      assert.strictEqual(llm.calls[0].options.temperature, 0.3);
    });

    it("uses higher temperature for smart triage", async () => {
      const llm = new MockLLM();
      const input = msg("tell me a story");
      const context = new Context();
      const route = { tier: "T2", handler: "smart_triage", params: { text: "tell me a story" } };

      await processT2Message({ input, context, route, llm });

      assert.strictEqual(llm.calls[0].options.temperature, 0.7);
    });

    it("allows model override via opts", async () => {
      const llm = new MockLLM();
      const input = msg("test");
      const context = new Context();
      const route = { tier: "T2", handler: "smart_triage", params: {} };

      await processT2Message({ input, context, route, llm, opts: { model: "gemma4:26b" } });

      assert.strictEqual(llm.calls[0].model, "gemma4:26b");
    });
  });

  describe("assessComplexity", () => {
    it("returns baseline complexity 3 for simple question", () => {
      const r = assessComplexity(msg("what time is it?"), new Context());
      assert.strictEqual(r.complexity, 3);
      assert.strictEqual(r.delegation.level, "interview");
    });

    it("increases complexity for task keywords", () => {
      const r = assessComplexity(msg("build a new API endpoint"), new Context());
      assert.ok(r.complexity >= 5);
    });

    it("increases complexity for long messages", () => {
      const longText = "x ".repeat(300); // 600 chars
      const r = assessComplexity(msg(longText), new Context());
      assert.ok(r.complexity >= 4);
    });

    it("increases complexity for multi-step indicators", () => {
      const r = assessComplexity(msg("first build the API, then write tests, finally deploy"), new Context());
      assert.ok(r.complexity >= 6);
    });

    it("increases complexity when services are down", () => {
      const ctx = new Context({
        services: [new Service({ name: "wa", port: 3478, status: "dead" })],
      });
      const normal = assessComplexity(msg("hello"), new Context());
      const degraded = assessComplexity(msg("hello"), ctx);
      assert.ok(degraded.complexity > normal.complexity);
    });

    it("caps at 10", () => {
      const text = "build and implement a massive migration first then refactor after that deploy step 1 step 2 " + "x ".repeat(500);
      const r = assessComplexity(msg(text), new Context());
      assert.ok(r.complexity <= 10);
    });

    it("returns matching delegation level", () => {
      const r = assessComplexity(msg("simple"), new Context());
      assert.ok(r.delegation.level);
      assert.ok(r.delegation.modelTier);
    });
  });

  describe("buildSystemPrompt", () => {
    it("includes base identity", () => {
      const prompt = buildSystemPrompt(new Context(), { handler: "smart_triage", params: {} });
      assert.ok(prompt.includes("Mr. V"));
    });

    it("includes minister role when handler is minister_chat", () => {
      const prompt = buildSystemPrompt(new Context(), {
        handler: "minister_chat",
        params: { minister: "planning" },
      });
      assert.ok(prompt.includes("planning"));
    });

    it("includes down services alert", () => {
      const ctx = new Context({
        services: [new Service({ name: "whatsapp", port: 3478, status: "dead" })],
      });
      const prompt = buildSystemPrompt(ctx, { handler: "smart_triage", params: {} });
      assert.ok(prompt.includes("whatsapp"));
      assert.ok(prompt.includes("DOWN"));
    });

    it("includes active plan progress", () => {
      const ctx = new Context({
        plans: [
          new Plan({
            id: "master-plan", title: "Master",
            tasks: [
              { id: "T1", title: "A", status: "done" },
              { id: "T2", title: "B" },
            ],
          }),
        ],
      });
      const prompt = buildSystemPrompt(ctx, { handler: "smart_triage", params: {} });
      assert.ok(prompt.includes("master-plan"));
      assert.ok(prompt.includes("1/2"));
    });
  });
});
