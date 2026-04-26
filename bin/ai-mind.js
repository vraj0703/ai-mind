#!/usr/bin/env node

/**
 * ai-mind CLI dispatcher.
 *
 * Subcommands:
 *   ai-mind mcp                     — start MCP server on stdio (for Claude Code etc.)
 *   ai-mind serve                   — start HTTP server on port 3486
 *   ai-mind chat <message>          — one-shot: send a message, print the decision
 *   ai-mind status                  — one-shot: print supervisor status
 *   ai-mind --help                  — list commands
 *   ai-mind --version               — print version
 *
 * Bindings default to mocks. Flip via `MIND_USE_REAL=all` (or comma-separated
 * binding names) — see CONTRACTS.md.
 */

const path = require("path");
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Re-resolve via the package's own require so we always pick up the same
// installation as `package.json` — works whether invoked via `npx` or via
// a globally-installed bin.
const pkg = require(path.join(PROJECT_ROOT, "package.json"));

function usage() {
  console.log(`ai-mind v${pkg.version}

Usage:
  ai-mind <command> [args]

Commands:
  mcp                      Start the MCP server on stdio
                           (for Claude Code, Cursor, Codex)
  serve                    Start the HTTP server on port 3486
  chat <message>           Send one message, print the routed decision
  status                   Print the supervisor status snapshot
  --help, -h               Show this help
  --version, -v            Print version

Bindings:
  Default                  All mocks (no Ollama, no peers, no submodules)
  MIND_USE_REAL=all        Flip every binding to its real implementation
  MIND_USE_REAL=llm,plan   Flip listed bindings; others stay mock

Examples:
  ai-mind chat /status
  MIND_USE_REAL=all ai-mind serve
  ai-mind mcp                        # then add to .mcp.json
`);
}

async function main(argv) {
  const cmd = argv[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    usage();
    return 0;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log(pkg.version);
    return 0;
  }

  // ── mcp ──────────────────────────────────────────────────
  if (cmd === "mcp") {
    const { createContainer } = require(path.join(PROJECT_ROOT, "di", "container.js"));
    const { SupervisorController } = require(path.join(PROJECT_ROOT, "presentation", "state_management", "controllers", "supervisor_controller.js"));
    const { RouterController } = require(path.join(PROJECT_ROOT, "presentation", "state_management", "controllers", "router_controller.js"));
    const { createMcpServer, startStdio } = require(path.join(PROJECT_ROOT, "presentation", "mcp", "server.js"));

    const container = createContainer({ projectRoot: PROJECT_ROOT });
    const supervisor = new SupervisorController(container);
    const router = new RouterController(container);

    const server = createMcpServer({
      supervisor,
      router,
      info: { name: "ai-mind", version: pkg.version },
    });

    // MCP server speaks JSON-RPC on stdio. Don't write banners to stdout —
    // they'd corrupt the protocol stream. Diagnostics go to stderr.
    process.stderr.write(`[ai-mind mcp] v${pkg.version} ready (bindings: ${container.config.realBindings.length} real, ${container.config.mockBindings.length} mock)\n`);
    await startStdio(server);
    return 0;
  }

  // ── serve (HTTP) ─────────────────────────────────────────
  if (cmd === "serve") {
    require(path.join(PROJECT_ROOT, "index.js"));
    return 0;
  }

  // ── chat <message> ───────────────────────────────────────
  if (cmd === "chat") {
    const message = argv.slice(1).join(" ").trim();
    if (!message) {
      console.error("ai-mind chat: missing message argument");
      return 1;
    }
    const { createContainer } = require(path.join(PROJECT_ROOT, "di", "container.js"));
    const { SupervisorController } = require(path.join(PROJECT_ROOT, "presentation", "state_management", "controllers", "supervisor_controller.js"));
    const { RouterController } = require(path.join(PROJECT_ROOT, "presentation", "state_management", "controllers", "router_controller.js"));

    const container = createContainer({ projectRoot: PROJECT_ROOT });
    new SupervisorController(container); // construct for side effects (initial state)
    const router = new RouterController(container);

    const { decision, route } = await router.handleMessage({
      type: "message",
      source: "cli",
      sender: "cli-user",
      payload: message,
    });
    console.log(JSON.stringify({
      response: decision.payload,
      tier: route.tier,
      handler: route.handler,
      model: decision.model,
      confidence: decision.confidence,
      decisionId: decision.id,
    }, null, 2));
    return 0;
  }

  // ── status ───────────────────────────────────────────────
  if (cmd === "status") {
    const { createContainer } = require(path.join(PROJECT_ROOT, "di", "container.js"));
    const { SupervisorController } = require(path.join(PROJECT_ROOT, "presentation", "state_management", "controllers", "supervisor_controller.js"));

    const container = createContainer({ projectRoot: PROJECT_ROOT });
    const supervisor = new SupervisorController(container);
    console.log(JSON.stringify(supervisor.getStatus(), null, 2));
    return 0;
  }

  console.error(`ai-mind: unknown command "${cmd}". Try --help.`);
  return 2;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code || 0))
  .catch((err) => {
    console.error("[ai-mind] fatal:", err);
    process.exit(1);
  });
