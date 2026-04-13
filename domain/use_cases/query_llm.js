/**
 * queryLLM — thin use case wrapping an ILLMClient.generate call.
 *
 * Keeps presentation/DI out of the call path so use cases remain testable.
 */

/**
 * @param {object} params
 * @param {string} params.prompt
 * @param {string} [params.model]
 * @param {string} [params.system]
 * @param {number} [params.temperature]
 * @param {object|string} [params.format]
 * @param {import('../repositories/i_llm_client').ILLMClient} params.llmClient
 * @returns {Promise<{text: string, tokens: number, elapsedMs: number}>}
 */
async function queryLLM({ prompt, model, system, temperature = 0.3, format, llmClient }) {
  if (!llmClient) throw new Error("queryLLM: llmClient is required");
  return llmClient.generate({ prompt, model, system, temperature, format });
}

module.exports = { queryLLM };
