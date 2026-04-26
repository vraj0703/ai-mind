/**
 * Default mocks for every MOCKABLE coupling identified in AUDIT.toml.
 *
 * Each mock implements a domain interface from `mind/domain/repositories/i_*.js`.
 * The DI container imports from here when no real implementation is requested.
 */

const { StubLLMProvider }       = require("./stub_llm_provider");
const { StubLLMClient }         = require("./stub_llm_client");
const { InMemoryPlanStore }     = require("./in_memory_plan_store");
const { InMemoryStateWriter }   = require("./in_memory_state_writer");
const { InMemoryJobScheduler }  = require("./in_memory_job_scheduler");
const { ConsoleAlertChannel }   = require("./console_alert_channel");
const { NoopServiceMonitor }    = require("./noop_service_monitor");
const { StaticContextProvider } = require("./static_context_provider");

module.exports = {
  StubLLMProvider,
  StubLLMClient,
  InMemoryPlanStore,
  InMemoryStateWriter,
  InMemoryJobScheduler,
  ConsoleAlertChannel,
  NoopServiceMonitor,
  StaticContextProvider,
};
