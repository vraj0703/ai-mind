/**
 * ProcessMessage — given an Input + Context + routing decision, produce a Decision.
 *
 * This is the THINKING step. The router already decided the tier and handler.
 * This use case calls the LLM (via ILLMProvider interface) and formats the response.
 *
 * Dependencies: ILLMProvider (injected), entities, constants
 */

const { Decision } = require("../entities/decision");
const { recommend: recommendDelegation } = require("../entities/delegation_level");
const { EscalationRequired, LLMUnavailableError } = require("../exceptions");
const { OLLAMA_TIMEOUT_MS, MODEL_TRIAGE, MODEL_RESPONSE, MODEL_REASONING } = require("../constants");

/**
 * Process a T2 message (local LLM).
 *
 * @param {object} params
 * @param {import('../entities/input').Input} params.input
 * @param {import('../entities/context').Context} params.context
 * @param {object} params.route - output of routeInput()
 * @param {import('../repositories/i_llm_provider').ILLMProvider} params.llm
 * @param {object} [params.opts]
 * @param {string} [params.opts.model] - override model
 * @returns {Promise<Decision>}
 */
async function processT2Message({ input, context, route, llm, opts = {} }) {
  const available = await llm.isAvailable();
  if (!available) {
    throw new LLMUnavailableError("ollama", "local LLM not reachable");
  }

  const systemPrompt = buildSystemPrompt(context, route);
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload) },
  ];

  const model = opts.model || MODEL_RESPONSE;
  const result = await llm.complete(model, messages, {
    temperature: route.handler === "minister_chat" ? 0.3 : 0.7,
    maxTokens: 2048,
  });

  return new Decision({
    type: "response",
    target: input.source,
    payload: result.content,
    reasoning: `T2 ${route.handler} via ${model}`,
    confidence: 0.7,
    inputId: input.id,
    model: result.model,
    tokens: { in: result.tokensIn, out: result.tokensOut },
  });
}

/**
 * Classify complexity and recommend delegation level.
 * Used when the router returns "smart_triage" to decide if we can handle
 * locally or need to escalate.
 *
 * @param {import('../entities/input').Input} input
 * @param {import('../entities/context').Context} context
 * @returns {{ complexity: number, delegation: object }}
 */
function assessComplexity(input, context) {
  const text = typeof input.payload === "string" ? input.payload : "";
  let complexity = 3; // baseline

  // Length signals
  if (text.length > 500) complexity += 1;
  if (text.length > 1500) complexity += 1;

  // Task keywords
  const taskKeywords = /\b(build|implement|create|design|migrate|refactor|rewrite|deploy|fix|debug|audit)\b/i;
  if (taskKeywords.test(text)) complexity += 2;

  // Multi-step indicators
  const multiStep = /\b(first|then|after that|step \d|phase|finally|also)\b/i;
  if (multiStep.test(text)) complexity += 1;

  // Context-aware adjustments
  if (context.getDownServices().length > 0) complexity += 1; // system is degraded

  complexity = Math.min(10, Math.max(1, complexity));

  return {
    complexity,
    delegation: recommendDelegation(complexity),
  };
}

/**
 * Build a system prompt from context for LLM calls.
 * @param {import('../entities/context').Context} context
 * @param {object} route
 * @returns {string}
 */
function buildSystemPrompt(context, route) {
  const parts = [
    "You are Mr. V, Principal Secretary of Raj Sadan.",
    "Answer concisely and accurately.",
  ];

  if (route.handler === "minister_chat" && route.params?.minister) {
    parts.push(`You are currently acting as the Ministry of ${route.params.minister}.`);
  }

  const down = context.getDownServices();
  if (down.length > 0) {
    parts.push(`System alert: ${down.map(s => s.name).join(", ")} ${down.length === 1 ? "is" : "are"} DOWN.`);
  }

  const activePlans = context.getActivePlans();
  if (activePlans.length > 0) {
    const planSummaries = activePlans.map(p => {
      const prog = p.progress();
      return `${p.id}: ${prog.done}/${prog.total} done (${prog.pct}%)`;
    });
    parts.push(`Active plans: ${planSummaries.join("; ")}`);
  }

  return parts.join("\n");
}

module.exports = { processT2Message, assessComplexity, buildSystemPrompt };
