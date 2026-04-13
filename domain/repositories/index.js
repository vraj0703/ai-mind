/**
 * Domain repository interfaces — the contracts mind expects from the outside world.
 *
 * These are abstract classes with methods that throw "not implemented."
 * The data layer provides concrete implementations.
 * The DI layer binds them together.
 *
 * Rule: domain/ NEVER imports from data/. Domain only knows these interfaces.
 */

module.exports = {
  ...require("./i_llm_provider"),
  ...require("./i_service_monitor"),
  ...require("./i_plan_store"),
  ...require("./i_context_provider"),
  ...require("./i_state_writer"),
  ...require("./i_alert_channel"),
  ...require("./i_llm_client"),
  ...require("./i_job_scheduler"),
};
