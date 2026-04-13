/**
 * Raj Sadan Mind v2 — Entry Point
 *
 * Clean architecture: domain (pure logic) → data (I/O) → presentation (HTTP).
 * DI container binds interfaces to implementations.
 *
 * Start:  node v2/mind/index.js
 * Test:   node --test v2/mind/domain/use_cases/*.test.js
 * Health: curl http://127.0.0.1:3486/health
 * Chat:   curl -X POST http://127.0.0.1:3486/chat -H "Content-Type: application/json" -d '{"source":"cli","sender":"pm","payload":"/status"}'
 */

const path = require("path");
const { createContainer } = require("./di/container");
const { SupervisorController } = require("./presentation/state_management/controllers/supervisor_controller");
const { RouterController } = require("./presentation/state_management/controllers/router_controller");
const { createServer } = require("./presentation/pages/server");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PORT = parseInt(process.env.MIND_PORT) || 3486;

// ─── Services to monitor (same as cortex config, migrated here) ───
const SERVICES = [
  { name: "whatsapp",       port: 3478, health_url: "http://127.0.0.1:3478/health" },
  { name: "cron",           port: 3479, health_url: "http://127.0.0.1:3479/health" },
  { name: "content-engine", port: 3480, health_url: "http://127.0.0.1:3480/health", restart_enabled: false },
  { name: "dashboard",      port: 3482, health_url: "http://127.0.0.1:3482/health" },
  { name: "brain",          port: 3483, health_url: "http://127.0.0.1:3483/health" },
  { name: "knowledge",      port: 3489, health_url: "http://127.0.0.1:3489/health" },
];

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║     Raj Sadan Mind v2                ║");
  console.log("║     Clean Architecture · 91 Tests    ║");
  console.log("╚══════════════════════════════════════╝");
  console.log();

  // ─── Step 1: Wire dependencies ───
  const container = createContainer({
    projectRoot: PROJECT_ROOT,
    port: PORT,
    services: SERVICES,
  });

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
