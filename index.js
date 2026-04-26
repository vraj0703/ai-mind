/**
 * ai-mind — Entry Point
 *
 * Clean architecture: domain (pure logic) → data (I/O) → presentation (HTTP).
 * DI container binds interfaces to implementations (mock by default — see
 * EXTRACTION_STRATEGY.md and CONTRACTS.md).
 *
 * Start:           node index.js                  (all mocks, zero deps)
 * Start with reals: MIND_USE_REAL=all node index.js
 * Selective:        MIND_USE_REAL=llm,plan node index.js
 * Test:            npm test
 * Health:          curl http://127.0.0.1:3486/health
 * Chat:            curl -X POST http://127.0.0.1:3486/chat -H "Content-Type: application/json" -d '{"source":"cli","sender":"pm","payload":"/status"}'
 */

const path = require("path");
const { createContainer } = require("./di/container");
const { SupervisorController } = require("./presentation/state_management/controllers/supervisor_controller");
const { RouterController } = require("./presentation/state_management/controllers/router_controller");
const { createServer } = require("./presentation/pages/server");

const PROJECT_ROOT = process.env.MIND_PROJECT_ROOT || path.resolve(__dirname, "..");
const PORT = parseInt(process.env.MIND_PORT) || 3486;

// ─── Peer services to monitor (raj-sadan organ topology) ───
// Empty by default (supervisor-of-self mode). Populated via env when peers
// are present. raj-sadan boot sets MIND_PEER_SERVICES to enable monitoring.
const SERVICES = process.env.MIND_PEER_SERVICES === "raj-sadan-organs" ? [
  { name: "memory",    port: 3488, health_url: "http://127.0.0.1:3488/health" },
  { name: "senses",    port: 3487, health_url: "http://127.0.0.1:3487/health" },
  { name: "knowledge", port: 3489, health_url: "http://127.0.0.1:3489/health" },
  { name: "dashboard", port: 3491, health_url: "http://127.0.0.1:3491/health" },
] : [];

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     ai-mind                          ║");
  console.log("║     Cognitive layer · clean arch     ║");
  console.log("╚══════════════════════════════════════╝");
  console.log();

  // ─── Step 1: Wire dependencies ───
  const container = createContainer({
    projectRoot: PROJECT_ROOT,
    port: PORT,
    services: SERVICES,
  });

  console.log(`[ai-mind] bindings — real: [${container.config.realBindings.join(", ") || "none"}]`);
  console.log(`[ai-mind] bindings — mock: [${container.config.mockBindings.join(", ")}]`);
  if (SERVICES.length === 0) {
    console.log(`[ai-mind] supervisor-of-self mode (no peer services)`);
  }

  // ─── Step 2: Create controllers ───
  const supervisor = new SupervisorController(container);
  const router = new RouterController(container);

  // ─── Step 3: Create and start HTTP server ───
  const { listen } = createServer({ supervisor, router, port: PORT });
  await listen();

  // ─── Step 4: Start supervisor loop ───
  supervisor.start();

  // ─── Graceful shutdown ───
  const shutdown = async () => {
    console.log("\n[mind-v2] shutting down...");
    supervisor.stop();
    await container.stateWriter.writeSession({
      sessionId: supervisor._sessionId,
      startedAt: supervisor._startedAt,
      cleanShutdown: true,
      uptimeMinutes: supervisor.getStatus().uptimeMinutes,
      alerts: [],
      services: supervisor.serviceList,
    });
    console.log("[mind-v2] clean shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  console.error("[mind-v2] fatal:", err);
  process.exit(1);
});
