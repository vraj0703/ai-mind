/**
 * MCP server — exposes ai-mind's cognitive primitives as MCP tools.
 *
 * Wraps the same RouterController + SupervisorController used by the HTTP
 * server. AI Agent CLIs (Claude Code, Cursor, Codex) connect via stdio and
 * call these tools directly — no HTTP layer in between.
 *
 * Four tools today:
 *   mind_chat      — send a message, get a routed decision
 *   mind_route     — classify without executing (router visibility)
 *   mind_status    — supervisor status snapshot
 *   mind_inbox     — query the T3 escalation inbox
 *
 * Adding a tool: register it here + document it in MCP-INTEGRATION.md.
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const { Input } = require("../../domain/entities/input");
const { routeInput } = require("../../domain/use_cases/route_input");

/**
 * Build a configured McpServer wrapping the given supervisor + router.
 *
 * @param {object} deps
 * @param {SupervisorController} deps.supervisor
 * @param {RouterController}     deps.router
 * @param {object}              [deps.info] - { name, version }
 * @returns {McpServer}
 */
function createMcpServer({ supervisor, router, info = {} }) {
  const server = new McpServer({
    name: info.name || "ai-mind",
    version: info.version || "0.1.0",
  });

  // ── mind_chat ────────────────────────────────────────────────
  server.registerTool(
    "mind_chat",
    {
      title: "Chat with ai-mind",
      description:
        "Send a message to the cognitive layer. Returns the routed decision and tier classification. Use this for any natural-language interaction with mind.",
      inputSchema: {
        message: z.string().describe("The text message to send to ai-mind"),
        sender: z.string().optional().describe("Identifier of the sender (default: 'mcp-client')"),
        priority: z.enum(["normal", "urgent"]).optional().describe("Message priority — 'urgent' bypasses routing and goes straight to T3"),
      },
    },
    async (args) => {
      const { decision, route } = await router.handleMessage({
        type: "message",
        source: "mcp",
        sender: args.sender || "mcp-client",
        payload: args.message,
        priority: args.priority || "normal",
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            response: decision.payload,
            tier: route.tier,
            handler: route.handler,
            model: decision.model,
            confidence: decision.confidence,
            decisionId: decision.id,
          }, null, 2),
        }],
      };
    },
  );

  // ── mind_route ───────────────────────────────────────────────
  server.registerTool(
    "mind_route",
    {
      title: "Classify a message",
      description:
        "Run the deterministic classifier on a message without executing it. Returns the tier (T1/T2/T3) and handler that would be selected. Useful for debugging routing rules or pre-validating messages before sending them.",
      inputSchema: {
        message: z.string().describe("The text message to classify"),
        priority: z.enum(["normal", "urgent"]).optional().describe("Message priority"),
      },
    },
    async (args) => {
      const input = new Input({
        type: "message",
        source: "mcp",
        sender: "mcp-client",
        payload: args.message,
        priority: args.priority || "normal",
      });
      const route = routeInput(input);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(route, null, 2),
        }],
      };
    },
  );

  // ── mind_status ──────────────────────────────────────────────
  server.registerTool(
    "mind_status",
    {
      title: "Get supervisor status",
      description:
        "Snapshot of supervisor state: services being monitored, recent decisions, uptime, current real/mock binding configuration. Use to understand mind's current operational state.",
      inputSchema: {},
    },
    async () => {
      const status = supervisor.getStatus();
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    },
  );

  // ── mind_inbox ───────────────────────────────────────────────
  server.registerTool(
    "mind_inbox",
    {
      title: "Query the T3 escalation inbox",
      description:
        "List messages that were escalated to T3 (executive tier) and are awaiting a human response. Use this to check what needs your attention.",
      inputSchema: {
        status: z.enum(["pending", "responded", "all"]).optional().describe("Filter by status (default: 'pending')"),
      },
    },
    async (args) => {
      const status = args.status === "all" ? null : (args.status || "pending");
      const items = router.getInbox(status);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ count: items.length, items }, null, 2),
        }],
      };
    },
  );

  return server;
}

/**
 * Connect an McpServer to stdio and start handling requests.
 * Returns when the connection closes (client disconnects).
 */
async function startStdio(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

module.exports = { createMcpServer, startStdio };
