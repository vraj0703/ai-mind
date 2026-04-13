/**
 * DelegationLevel — how complex a task is and what execution mode it needs.
 *
 * Maps complexity (1-10) to an execution strategy.
 * Lower complexity = do it yourself. Higher = build a team.
 */

const LEVELS = {
  solo: {
    name: "solo",
    complexityRange: [1, 2],
    description: "Single call, local model. No help needed.",
    maxSubagents: 0,
    requiresPlanApproval: false,
    requiresInterview: false,
    persistent: false,
    modelTier: "T1",
  },
  interview: {
    name: "interview",
    complexityRange: [3, 4],
    description: "Clarify requirements before acting. One round-trip.",
    maxSubagents: 0,
    requiresPlanApproval: false,
    requiresInterview: true,
    persistent: false,
    modelTier: "T1",
  },
  plan: {
    name: "plan",
    complexityRange: [5, 6],
    description: "Generate a plan, get PM approval, then execute steps.",
    maxSubagents: 1,
    requiresPlanApproval: true,
    requiresInterview: false,
    persistent: false,
    modelTier: "T2",
  },
  team: {
    name: "team",
    complexityRange: [7, 8],
    description: "Parallel subagents working together. Coordinate results.",
    maxSubagents: 4,
    requiresPlanApproval: true,
    requiresInterview: false,
    persistent: false,
    modelTier: "T2",
  },
  persistent: {
    name: "persistent",
    complexityRange: [9, 10],
    description: "Autonomous loop. Keep working until done or stuck.",
    maxSubagents: 4,
    requiresPlanApproval: true,
    requiresInterview: true,
    persistent: true,
    modelTier: "T3",
  },
};

function classify(complexity) {
  if (typeof complexity !== "number" || complexity < 1) return "solo";
  if (complexity <= 2) return "solo";
  if (complexity <= 4) return "interview";
  if (complexity <= 6) return "plan";
  if (complexity <= 8) return "team";
  return "persistent";
}

function getConfig(level) {
  return LEVELS[level] || LEVELS.solo;
}

function recommend(complexity) {
  const level = classify(complexity);
  return { level, ...getConfig(level) };
}

module.exports = { LEVELS, classify, getConfig, recommend };
