/**
 * StubLLMClient — default in-tree mock for ILLMClient.
 *
 * Lower-level than StubLLMProvider — returns the raw {text, tokens, elapsedMs}
 * shape that the Ollama HTTP client returns.
 */

const { ILLMClient } = require("../../../domain/repositories/i_llm_client");

class StubLLMClient extends ILLMClient {
  constructor(opts = {}) {
    super();
    this._models = opts.models || [
      { name: "mock-fast", size: 0, parameterSize: "0B" },
      { name: "mock-reasoning", size: 0, parameterSize: "0B" },
    ];
  }

  async listModels() {
    return [...this._models];
  }

  async generate(params = {}) {
    const start = Date.now();
    const prompt = params.prompt || "";
    const text = params.format
      ? JSON.stringify({ mock: true, echo: prompt.slice(0, 80) })
      : `[mock] ${prompt.slice(0, 200)}`;
    return {
      text,
      tokens: text.length,
      elapsedMs: Date.now() - start,
    };
  }

  async isAvailable() {
    return true;
  }
}

module.exports = { StubLLMClient };
