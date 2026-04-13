/**
 * Domain constants — business-level values that shape mind's behavior.
 *
 * These are tunable knobs. Changing them changes how mind behaves
 * without changing any logic. All values have documented defaults
 * and a reason for the current setting.
 */

module.exports = {
  // ─── Supervisor intervals (ms) ───
  WATCHDOG_INTERVAL_MS: 60_000,        // health-check all services
  HEARTBEAT_INTERVAL_MS: 300_000,      // write HEARTBEAT.toml (5 min)
  PLAN_EVAL_INTERVAL_MS: 300_000,      // evaluate plans for unblocked tasks (5 min)
  SESSION_WRITE_INTERVAL_MS: 60_000,   // write session.toml (every loop)
  RESOURCE_CHECK_INTERVAL_MS: 120_000, // CPU/RAM/VRAM snapshot (2 min)

  // ─── Watchdog escalation ───
  MAX_RESTARTS_PER_SERVICE: 3,         // give up and alert PM after 3 restarts
  RESTART_COOLDOWN_MS: 120_000,        // min time between restart attempts for same service
  HEALTH_CHECK_TIMEOUT_MS: 5_000,      // HTTP health check timeout
  RESTART_TIMEOUT_MS: 15_000,          // wait for service to recover after restart

  // ─── LLM models (Gemma 4 family) ───
  MODEL_TRIAGE: "gemma4:e2b",          // fastest — classify complexity, quick decisions (<1s)
  MODEL_RESPONSE: "gemma4:e4b",        // balanced — T2 responses, minister chats (128K ctx)
  MODEL_REASONING: "gemma4:26b",       // best quality — complex T3 auto-responses (256K ctx, MoE)
  MODEL_CODE: "qwen2.5-coder:7b",     // code specialist — kept for code-specific tasks
  MODEL_EMBEDDING: "nomic-embed-text:v1.5", // embeddings (768 dims)
  MODEL_FALLBACK: "llama3.2:3b",       // fallback if Gemma unavailable

  // ─── LLM routing ───
  OLLAMA_HOST: "http://localhost:11434", // Ollama client base URL
  OLLAMA_DEFAULT_MODEL: "gemma4:e4b",    // default model for queryLLM use case
  OLLAMA_TIMEOUT_MS: 120_000,          // local LLM call timeout (2 min)

  // ─── External services ───
  CRON_HOST: "http://127.0.0.1:3479",  // v1 cron service base URL
  CLAUDE_TIMEOUT_MS: 120_000,          // Claude brain call timeout (2 min)
  CLAUDE_MINISTER_TIMEOUT_MS: 300_000, // Claude minister call timeout (5 min)

  // ─── T3 escalation ───
  MR_V_OFFLINE_THRESHOLD_MS: 1_800_000, // 30 min before cortex auto-responds to T3
  MAX_AUTO_RESPONSES_PER_TICK: 2,       // rate limit auto-responses per loop

  // ─── Plan execution ───
  MIN_TASK_SCORE_FOR_EXECUTION: 30,     // only execute tasks scoring above this
  MAX_CONCURRENT_TASKS: 1,              // cortex executes at most N tasks in parallel

  // ─── Conversation ───
  MAX_CONVERSATION_LENGTH: 20,          // trim older messages per (interface, sender)
  MAX_RECENT_MESSAGES: 100,             // rolling log of recent messages across all conversations

  // ─── Decision log ───
  MAX_DECISIONS_IN_MEMORY: 500,         // keep last N decisions in RAM for quick queries
};
