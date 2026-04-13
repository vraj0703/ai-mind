/**
 * ILLMProvider — abstract interface for LLM completion.
 *
 * Mind's domain calls this to generate text. The data layer
 * decides whether it goes to Ollama, Gemini, Anthropic, or a mock.
 *
 * Implementations: data/repositories/ollama_llm_repository.js, etc.
 */

class ILLMProvider {
  /**
   * Check if this provider is available (e.g., Ollama is running).
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error("ILLMProvider.isAvailable() not implemented");
  }

  /**
   * Generate a completion.
   * @param {string}   model      - model ID (e.g., "qwen2.5:14b", "claude-sonnet-4-20250514")
   * @param {Array<{role: string, content: string}>} messages - conversation messages
   * @param {object}   [options]  - { temperature, maxTokens, format }
   * @returns {Promise<{content: string, model: string, tokensIn: number, tokensOut: number}>}
   */
  async complete(model, messages, options = {}) {
    throw new Error("ILLMProvider.complete() not implemented");
  }

  /**
   * List available models on this provider.
   * @returns {Promise<string[]>}
   */
  async listModels() {
    throw new Error("ILLMProvider.listModels() not implemented");
  }
}

module.exports = { ILLMProvider };
