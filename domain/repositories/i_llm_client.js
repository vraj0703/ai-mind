/**
 * ILLMClient — interface for a thin LLM inference client (Ollama-style).
 *
 * Distinct from ILLMProvider (which wraps higher-level response generation).
 * This interface exposes raw model listing + single-shot generate.
 */

class ILLMClient {
  /** @returns {Promise<{name: string, size: number, parameterSize: string}[]>} */
  async listModels() { throw new Error("not implemented"); }

  /**
   * @param {object} params
   * @param {string} params.model
   * @param {string} params.prompt
   * @param {string} [params.system]
   * @param {number} [params.temperature]
   * @param {object} [params.format] - for JSON mode
   * @returns {Promise<{text: string, tokens: number, elapsedMs: number}>}
   */
  async generate(params) { throw new Error("not implemented"); }

  /** @returns {Promise<boolean>} */
  async isAvailable() { throw new Error("not implemented"); }
}

module.exports = { ILLMClient };
