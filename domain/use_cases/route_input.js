/**
 * RouteInput — classify an Input into T1/T2/T3 and determine the handler.
 *
 * This is the FIRST thing that happens when mind receives an input.
 * Pure logic: no LLM, no I/O, no side effects.
 *
 * Dependencies: none (uses only entities + constants)
 */

const { T1, T2, T3 } = require("../entities/tier");

// T1 commands — instant, no AI needed
const T1_COMMANDS = new Map([
  ["/status",     "service_health"],
  ["/plan",       "plan_summary"],
  ["/cron",       "cron_control"],
  ["/help",       "help"],
  ["/know",       "knowledge_search"],
  ["/tools",      "knowledge_tools"],
  ["/memory",     "memory_summary"],
]);

// T1 focus commands — PM task management
const FOCUS_COMMANDS = ["done", "skip", "later", "focus", "unpin"];

// T3 explicit escalation prefixes
const T3_PREFIXES = ["/mrv", "/urgent", "/brain", "/deploy"];

// T2 minister routing prefixes
const MINISTER_PREFIXES = ["@planning", "@review", "@resources", "@external-affairs", "@design"];

/**
 * @param {import('../entities/input').Input} input
 * @returns {{tier: string, handler: string, params: object}}
 */
function routeInput(input) {
  if (!input || !input.isMessage()) {
    return { tier: T1, handler: "passthrough", params: {} };
  }

  const text = typeof input.payload === "string" ? input.payload.trim() : "";
  if (!text) {
    return { tier: T1, handler: "empty", params: {} };
  }

  const lower = text.toLowerCase();

  // ─── Urgent inputs bypass all routing ───
  if (input.isUrgent()) {
    return { tier: T3, handler: "escalate_urgent", params: { text } };
  }

  // ─── T1: direct commands ───
  for (const [cmd, handler] of T1_COMMANDS) {
    if (lower === cmd || lower.startsWith(cmd + " ")) {
      const args = text.slice(cmd.length).trim();
      return { tier: T1, handler, params: { args } };
    }
  }

  // ─── T1: focus commands (done plan:task, skip, etc.) ───
  const firstWord = lower.split(/\s+/)[0];
  if (FOCUS_COMMANDS.includes(firstWord)) {
    return { tier: T1, handler: "focus_command", params: { command: text } };
  }

  // ─── T3: explicit escalation ───
  for (const prefix of T3_PREFIXES) {
    if (lower.startsWith(prefix + " ") || lower === prefix) {
      const msg = text.slice(prefix.length).trim();
      const handler = prefix === "/deploy" ? "deploy_minister" : "escalate_explicit";
      return { tier: T3, handler, params: { text: msg, prefix } };
    }
  }

  // ─── T2: minister routing ───
  for (const prefix of MINISTER_PREFIXES) {
    if (lower.startsWith(prefix + " ") || lower === prefix) {
      const minister = prefix.slice(1); // remove @
      const msg = text.slice(prefix.length).trim();
      return { tier: T2, handler: "minister_chat", params: { minister, text: msg } };
    }
  }

  // ─── T2: @cortex commands ───
  if (lower.startsWith("@cortex")) {
    const cmd = text.slice("@cortex".length).trim();
    return { tier: T1, handler: "cortex_command", params: { command: cmd } };
  }

  // ─── Default: T2 smart triage (let LLM decide) ───
  return { tier: T2, handler: "smart_triage", params: { text } };
}

module.exports = { routeInput, T1_COMMANDS, FOCUS_COMMANDS, T3_PREFIXES, MINISTER_PREFIXES };
