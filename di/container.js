/**
 * DI Container — binds domain interfaces to data-layer implementations.
 *
 * This is the ONLY place that knows about concrete classes.
 * Everything else works with interfaces.
 */

const path = require("path");
const { Service } = require("../domain/entities/service");

// Data layer implementations
const { OllamaLLMRepository } = require("../data/repositories/ollama_llm_repository");
const { HTTPServiceMonitor } = require("../data/repositories/http_service_monitor");
const { TOMLPlanStore } = require("../data/repositories/toml_plan_store");
const { FileStateWriter } = require("../data/repositories/file_state_writer");
const { WhatsAppAlertChannel } = require("../data/repositories/whatsapp_alert_channel");
const { ContextAssembler } = require("../data/repositories/context_assembler");
const { OllamaLLMClient } = require("../data/data_sources/remote/ollama_llm_client");
const { HttpJobScheduler } = require("../data/data_sources/remote/http_job_scheduler");
const { OLLAMA_DEFAULT_MODEL, CRON_HOST } = require("../domain/constants");

/**
 * Create a fully wired container from a config object.
 *
 * @param {object} config
 * @param {string} config.projectRoot  - absolute path to raj_sadan root
 * @param {string} [config.ollamaHost]
 * @param {string} [config.whatsappHost]
 * @param {number} [config.port]       - mind HTTP port
 * @param {object[]} [config.services] - service definitions from cortex config
 * @returns {object} - all repositories + service list + config
 */
function createContainer(config = {}) {
  const projectRoot = config.projectRoot || process.cwd();
  const port = config.port || 3485;

  // Build service list from config
  const serviceList = (config.services || []).map(s => new Service({
    name: s.name,
    port: s.port,
    healthUrl: s.health_url || s.healthUrl || `http://127.0.0.1:${s.port}/health`,
    restartEnabled: s.restart_enabled !== false,
    status: "unknown",
  }));

  // Instantiate repositories
  // OLLAMA_HOST env is the BIND address (0.0.0.0) — not valid for client calls
  const envOllama = process.env.OLLAMA_HOST;
  const ollamaHost = config.ollamaHost
    || (envOllama && !envOllama.includes("0.0.0.0") ? envOllama : null)
    || "http://localhost:11434";
  const llm = new OllamaLLMRepository({ host: ollamaHost });

  const serviceMonitor = new HTTPServiceMonitor({ projectRoot });

  const planStore = new TOMLPlanStore({
    plansDir: path.join(projectRoot, "plans"),
  });

  const stateWriter = new FileStateWriter({ projectRoot });

  const alertChannel = new WhatsAppAlertChannel({
    host: config.whatsappHost || "http://127.0.0.1:3478",
  });

  const contextProvider = new ContextAssembler({
    planStore,
    serviceMonitor,
    serviceList,
  });

  // Gateway clients ported from v1 (Ollama LLM, cron service)
  const llmClient = new OllamaLLMClient({
    host: ollamaHost,
    defaultModel: OLLAMA_DEFAULT_MODEL,
  });
  const jobScheduler = new HttpJobScheduler({
    host: config.cronHost || CRON_HOST,
  });

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

    // Config
    config: {
      projectRoot,
      port,
    },
  };
}

module.exports = { createContainer };
