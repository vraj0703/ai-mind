/**
 * OllamaLLMClient — thin HTTP client for Ollama local LLM inference.
 *
 * Ports v1 senses/gateway/ollama.js into v2/mind's DDD structure.
 * Never throws on network failures — returns null / degraded status.
 */

const { ILLMClient } = require("../../../domain/repositories/i_llm_client");
const { OLLAMA_HOST, OLLAMA_DEFAULT_MODEL, OLLAMA_TIMEOUT_MS } = require("../../../domain/constants");

class OllamaLLMClient extends ILLMClient {
  /**
   * @param {object} [opts]
   * @param {string} [opts.host] - Ollama base URL
   * @param {string} [opts.defaultModel] - fallback model name
   * @param {number} [opts.timeout] - default request timeout in ms
   */
  constructor(opts = {}) {
    super();
    this.host = opts.host || OLLAMA_HOST;
    this.defaultModel = opts.defaultModel || OLLAMA_DEFAULT_MODEL;
    this.timeout = opts.timeout || OLLAMA_TIMEOUT_MS || 120_000;
  }

  /**
   * GET /api/tags — list installed models.
   * @returns {Promise<{name: string, size: number, parameterSize: string}[]>}
   */
  async listModels() {
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        console.log(`[mind-v2] ollama: listModels HTTP ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.models || []).map(m => ({
        name: m.name,
        size: m.size || 0,
        parameterSize: m.details?.parameter_size || "—",
      }));
    } catch (err) {
      console.log(`[mind-v2] ollama: listModels error: ${err.message}`);
      return [];
    }
  }

  /**
   * POST /api/generate — single-shot generation (stream: false).
   * @param {object} params
   * @param {string} params.model
   * @param {string} params.prompt
   * @param {string} [params.system]
   * @param {number} [params.temperature]
   * @param {object|string} [params.format] - "json" for JSON mode
   * @returns {Promise<{text: string, tokens: number, elapsedMs: number}>}
   */
  async generate({ model, prompt, system, temperature = 0.7, format } = {}) {
    const started = Date.now();
    const body = {
      model: model || this.defaultModel,
      prompt: prompt || "",
      stream: false,
      options: { temperature: Number(temperature) },
    };
    if (system) body.system = system;
    if (format) body.format = format;

    try {
      const res = await fetch(`${this.host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.log(`[mind-v2] ollama: generate HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return { text: "", tokens: 0, elapsedMs: Date.now() - started };
      }

      const data = await res.json();
      return {
        text: data.response || "",
        tokens: data.eval_count || 0,
        elapsedMs: Date.now() - started,
      };
    } catch (err) {
      console.log(`[mind-v2] ollama: generate error: ${err.message}`);
      return { text: "", tokens: 0, elapsedMs: Date.now() - started };
    }
  }

  /**
   * Quick probe — true if Ollama answers /api/tags within 3s.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch (err) {
      console.log(`[mind-v2] ollama: isAvailable false (${err.message})`);
      return false;
    }
  }
}

module.exports = { OllamaLLMClient };
