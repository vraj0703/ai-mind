/**
 * Use cases — the 6 things mind DOES.
 *
 * Each use case is a pure function (or async function) that:
 * - Takes entities + repository interfaces as input
 * - Returns entities (Decisions, Services, Tasks) as output
 * - Has zero direct I/O (no HTTP, no filesystem, no env vars)
 * - Is testable with mocks alone
 */

module.exports = {
  ...require("./route_input"),
  ...require("./process_message"),
  ...require("./supervise_services"),
  ...require("./evaluate_plans"),
  ...require("./escalate"),
  ...require("./execute_decision"),
  ...require("./query_llm"),
  ...require("./manage_jobs"),
  ...require("./generate_focus_brief"),
};
