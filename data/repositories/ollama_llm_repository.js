/**
 * OllamaLLMRepository — concrete ILLMProvider using local Ollama.
 */

const { ILLMProvider } = require("../../domain/repositories/i_llm_provider");
const { httpGet, httpPost } = require("../data_sources/remote/http_client");

class OllamaLLMRepository extends ILLMProvider {
  constructor(opts = {}) {
    super();
    // OLLAMA_HOST env is the BIND address (0.0.0.0) — not valid for client calls.
    // Always use localhost for client connections.
    const envHost = process.env.OLLAMA_HOST;
    const usableHost = envHost && !envHost.includes("0.0.0.0") ? envHost : null;
    this.host = opts.host || usableHost || "http://localhost:11434";
    this.timeoutMs = opts.timeoutMs || 120_000;
    this._healthCache = null;
    this._healthCacheTime = 0;
  }

  async isAvailable() {
    const now = Date.now();
    if (this._healthCache !== null && now - this._healthCacheTime < 30_000) {
      return this._healthCache;
    }
    const res = await httpGet(`${this.host}/api/tags`, { timeoutMs: 3000 });
    this._healthCache = res.ok;
    this._healthCacheTime = now;
    return res.ok;
  }

  async complete(model, messages, options = {}) {
    const body = {
      model,
      messages,
      stream: false,
      options: {},
    };
    if (options.temperature !== undefined) body.options.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.options.num_predict = options.maxTokens;

    const res = await httpPost(`${this.host}/api/chat`, body, { timeoutMs: this.timeoutMs });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.error || res.status} — ${res.raw?.slice?.(0, 200)}`);
    }

    const data = res.body;
    return {
      content: data?.message?.content || "",
      model: data?.model || model,
      tokensIn: data?.prompt_eval_count || 0,
      tokensOut: data?.eval_count || 0,
    };
  }

  async listModels() {
    const res = await httpGet(`${this.host}/api/tags`, { timeoutMs: 5000 });
    if (!res.ok || !res.body?.models) return [];
    return res.body.models.map(m => m.name);
  }
}

module.exports = { OllamaLLMRepository };
