/**
 * StubLLMProvider — default in-tree mock for ILLMProvider.
 *
 * Returns deterministic, pattern-matched responses. Smart enough to make tier-1
 * commands work; deliberately not smart enough to pretend it's a real LLM.
 *
 * Outputs always carry a `[mock]` marker so a reader can tell at a glance the
 * response wasn't from a real model.
 */

const { ILLMProvider } = require("../../../domain/repositories/i_llm_provider");

const KNOWN_MODELS = ["mock-fast", "mock-reasoning", "mock-coder"];

class StubLLMProvider extends ILLMProvider {
  constructor(opts = {}) {
    super();
    this._models = opts.models || KNOWN_MODELS;
  }

  async isAvailable() {
    return true;
  }

  async complete(model, messages, options = {}) {
    const lastUserMessage = (messages || [])
      .filter(m => m.role === "user")
      .map(m => m.content || "")
      .pop() || "";

    const content = this._respond(lastUserMessage, options);
    return {
      content,
      model: model || "mock-fast",
      tokensIn: lastUserMessage.length,
      tokensOut: content.length,
    };
  }

  async listModels() {
    return [...this._models];
  }

  _respond(input, options) {
    const trimmed = input.trim().toLowerCase();

    if (trimmed.startsWith("/status")) {
      return "[mock] Status: ai-mind running with default mocks. No external services connected.";
    }
    if (trimmed.startsWith("/help")) {
      return "[mock] Available: /status, /help, free-form chat. Wire a real LLM for richer responses.";
    }
    if (trimmed.startsWith("/")) {
      return `[mock] Unknown command: ${trimmed.split(/\s+/)[0]}`;
    }
    if (options && options.format) {
      return JSON.stringify({ mock: true, echo: input.slice(0, 80) });
    }

    return `[mock] Echo: ${input.slice(0, 200)}`;
  }
}

module.exports = { StubLLMProvider };
