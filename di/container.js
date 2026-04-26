/**
 * DI Container — binds domain interfaces to data-layer implementations.
 *
 * Mockability contract (see EXTRACTION_STRATEGY.md):
 *   - Every binding defaults to its in-tree mock from data/repositories/mocks.
 *   - Pass `use: { <binding>: 'real' | 'mock' }` to flip per-binding.
 *   - Pass `use: { <binding>: <instance> }` to inject directly.
 *   - Or set env `MIND_USE_REAL=binding1,binding2` (or `=all`) to flip via env.
 *
 * The 8 bindings:
 *   llm, llmClient, jobScheduler, serviceMonitor, planStore,
 *   stateWriter, alertChannel, contextProvider
 */

const path = require("path");
const { Service } = require("../domain/entities/service");

// Real implementations (data layer)
const { OllamaLLMRepository } = require("../data/repositories/ollama_llm_repository");
const { HTTPServiceMonitor }  = require("../data/repositories/http_service_monitor");
const { TOMLPlanStore }       = require("../data/repositories/toml_plan_store");
const { FileStateWriter }     = require("../data/repositories/file_state_writer");
const { WhatsAppAlertChannel } = require("../data/repositories/whatsapp_alert_channel");
const { ContextAssembler }    = require("../data/repositories/context_assembler");
const { OllamaLLMClient }     = require("../data/data_sources/remote/ollama_llm_client");
const { HttpJobScheduler }    = require("../data/data_sources/remote/http_job_scheduler");
const { OLLAMA_DEFAULT_MODEL, CRON_HOST } = require("../domain/constants");

// Default mocks (in-tree)
const Mocks = require("../data/repositories/mocks");

const ALL_BINDINGS = [
  "llm", "llmClient", "jobScheduler", "serviceMonitor",
  "planStore", "stateWriter", "alertChannel", "contextProvider",
];

/**
 * Decide which bindings should be REAL based on env + config.
 * Config wins over env. Returns a Set of binding names.
 */
function resolveRealBindings(useConfig = {}) {
  const real = new Set();

  // Env layer
  const envFlag = (process.env.MIND_USE_REAL || "").trim();
  if (envFlag === "all") {
    ALL_BINDINGS.forEach(b => real.add(b));
  } else if (envFlag) {
    envFlag.split(",").map(s => s.trim()).filter(Boolean).forEach(b => real.add(b));
  }

  // Config layer (wins over env)
  for (const [binding, choice] of Object.entries(useConfig)) {
    if (choice === "real" || (choice && typeof choice === "object")) {
      real.add(binding);
    } else if (choice === "mock") {
      real.delete(binding);
    }
  }

  return real;
}

/**
 * Create a fully wired container.
 *
 * @param {object} [config]
 * @param {string} [config.projectRoot]   - filesystem root for real impls; defaults to os.tmpdir()
 * @param {string} [config.ollamaHost]    - LLM host
 * @param {string} [config.whatsappHost]  - alert channel host
 * @param {string} [config.cronHost]      - job scheduler host
 * @param {number} [config.port]          - mind HTTP port
 * @param {object[]} [config.services]    - peer services to monitor (empty → supervisor-of-self mode)
 * @param {object} [config.use]           - per-binding 'real' | 'mock' | <instance>
 * @returns {object} container
 */
function createContainer(config = {}) {
  const projectRoot = config.projectRoot || require("os").tmpdir();
  const port = config.port || 3486;
  const useConfig = config.use || {};
  const real = resolveRealBindings(useConfig);

  const serviceList = (config.services || []).map(s => new Service({
    name: s.name,
    port: s.port,
    healthUrl: s.health_url || s.healthUrl || `http://127.0.0.1:${s.port}/health`,
    restartEnabled: s.restart_enabled !== false,
    status: "unknown",
  }));

  // Per-binding factory: returns the chosen instance for `name`.
  // Order: explicit instance in useConfig > real (per real Set) > mock
  function bind(name, mockFactory, realFactory) {
    const choice = useConfig[name];
    if (choice && typeof choice === "object") return choice; // injected instance
    if (real.has(name)) return realFactory();
    return mockFactory();
  }

  // Resolve hosts (used only by real impls)
  const envOllama = process.env.OLLAMA_HOST;
  const ollamaHost = config.ollamaHost
    || (envOllama && !envOllama.includes("0.0.0.0") ? envOllama : null)
    || "http://localhost:11434";
  const whatsappHost = config.whatsappHost || "http://127.0.0.1:3478";
  const cronHost = config.cronHost || CRON_HOST;

  const llm = bind("llm",
    () => new Mocks.StubLLMProvider(),
    () => new OllamaLLMRepository({ host: ollamaHost }));

  const llmClient = bind("llmClient",
    () => new Mocks.StubLLMClient(),
    () => new OllamaLLMClient({ host: ollamaHost, defaultModel: OLLAMA_DEFAULT_MODEL }));

  const jobScheduler = bind("jobScheduler",
    () => new Mocks.InMemoryJobScheduler(),
    () => new HttpJobScheduler({ host: cronHost }));

  const serviceMonitor = bind("serviceMonitor",
    () => new Mocks.NoopServiceMonitor(),
    () => new HTTPServiceMonitor({ projectRoot }));

  const planStore = bind("planStore",
    () => new Mocks.InMemoryPlanStore(),
    () => new TOMLPlanStore({ plansDir: path.join(projectRoot, "plans") }));

  const stateWriter = bind("stateWriter",
    () => new Mocks.InMemoryStateWriter(),
    () => new FileStateWriter({ projectRoot }));

  const alertChannel = bind("alertChannel",
    () => new Mocks.ConsoleAlertChannel(),
    () => new WhatsAppAlertChannel({ host: whatsappHost }));

  const contextProvider = bind("contextProvider",
    () => new Mocks.StaticContextProvider({ services: serviceList }),
    () => new ContextAssembler({ planStore, serviceMonitor, serviceList }));

  return {
    // Repositories (interface implementations)
    llm,
    llmClient,
    jobScheduler,
    serviceMonitor,
    planStore,
    stateWriter,
    alertChannel,
    contextProvider,

    // Raw data
    serviceList,

    // Config (echoed for diagnostic / test introspection)
    config: {
      projectRoot,
      port,
      realBindings: [...real],
      mockBindings: ALL_BINDINGS.filter(b => !real.has(b)),
    },
  };
}

module.exports = { createContainer, ALL_BINDINGS };
