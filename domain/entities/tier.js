/**
 * Tier — the 3-tier routing classification.
 *
 * T1: instant, no AI  (direct commands, lookups)
 * T2: local LLM       (Ollama, free/cheap)
 * T3: escalate         (Claude/Mr. V, premium)
 */

const T1 = "T1";
const T2 = "T2";
const T3 = "T3";

const TIER_META = {
  [T1]: {
    name: "Instant",
    description: "Direct commands, lookups — no AI needed",
    cost: 0,
    latency: "< 100ms",
    requiresLLM: false,
  },
  [T2]: {
    name: "Local LLM",
    description: "Handled by local Ollama models — free, 1-10s",
    cost: 0,
    latency: "1-10s",
    requiresLLM: true,
    provider: "ollama",
  },
  [T3]: {
    name: "Escalate",
    description: "Queued for Mr. V or sent to Claude — premium, 5-120s",
    cost: "variable",
    latency: "5-120s",
    requiresLLM: true,
    provider: "anthropic",
  },
};

function isValid(tier) {
  return tier === T1 || tier === T2 || tier === T3;
}

function getMeta(tier) {
  return TIER_META[tier] || null;
}

module.exports = { T1, T2, T3, TIER_META, isValid, getMeta };
