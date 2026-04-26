# MCP-INTEGRATION.md

How to drop `ai-mind` into an AI Agent CLI as an MCP server.

This file is one of three install paths — see `README.md` for the HTTP and one-shot CLI modes.

---

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) lets AI agent tools (Claude Code, Cursor, Codex, etc.) talk to local or remote servers that expose **tools**, **resources**, and **prompts**. `ai-mind` exposes its cognitive primitives as MCP tools — the agent can chat with mind, classify messages, check supervisor status, and inspect the escalation inbox.

When you add `ai-mind` to your `.mcp.json`, your AI agent gains four new tools without any HTTP plumbing.

---

## Quickstart — Claude Code

### 1. Install ai-mind globally (or use npx)

```bash
npm install -g ai-mind
# or skip this step — npx fetches on demand
```

### 2. Add to `.mcp.json`

In your project root (or `~/.claude.json` for global):

```json
{
  "mcpServers": {
    "ai-mind": {
      "command": "npx",
      "args": ["-y", "ai-mind", "mcp"]
    }
  }
}
```

### 3. Restart Claude Code

The four `mind_*` tools are now available to the agent.

### 4. Verify

In Claude Code, ask:

> "Use mind_status to show the current supervisor state."

You should see a JSON response with `services`, `recentDecisions`, `uptimeMinutes`, etc. If you do, the integration is live.

---

## With real LLM (opt-in)

By default ai-mind boots with mocks — `mind_chat` returns `[mock]`-tagged responses. To wire the real LLM:

```json
{
  "mcpServers": {
    "ai-mind": {
      "command": "npx",
      "args": ["-y", "ai-mind", "mcp"],
      "env": {
        "MIND_USE_REAL": "llm,llmClient",
        "OLLAMA_HOST": "http://localhost:11434"
      }
    }
  }
}
```

Replace `localhost:11434` with whatever your Ollama (or Ollama-compatible) endpoint is. To flip everything real, use `MIND_USE_REAL=all`. See `CONTRACTS.md` for the full per-binding swap reference.

---

## With peer services (raj-sadan topology)

If you're running ai-mind alongside the raj-sadan organ mesh:

```json
{
  "mcpServers": {
    "ai-mind": {
      "command": "npx",
      "args": ["-y", "ai-mind", "mcp"],
      "env": {
        "MIND_USE_REAL": "all",
        "MIND_PEER_SERVICES": "raj-sadan-organs"
      }
    }
  }
}
```

This wires real implementations and enables monitoring of the four sibling organs (memory, senses, knowledge, dashboard) on their respective ports.

---

## The four tools

### `mind_chat`

Send a message to the cognitive layer. Returns the routed decision plus tier classification.

**Inputs**
- `message` (string, required) — the text to send
- `sender` (string, optional) — identifier of the sender; defaults to `"mcp-client"`
- `priority` (`"normal"` | `"urgent"`, optional) — `"urgent"` bypasses routing and goes straight to T3 (escalation)

**Output (JSON)**
```json
{
  "response": "<text response from mind>",
  "tier": "T1" | "T2" | "T3",
  "handler": "<which handler ran>",
  "model": "<model name or null>",
  "confidence": 0.0-1.0,
  "decisionId": "d-..."
}
```

**Use this for** any natural-language interaction with mind. Most agent flows reach for this first.

---

### `mind_route`

Run the deterministic classifier on a message without executing it. Useful for debugging routing rules or pre-validating before sending.

**Inputs**
- `message` (string, required) — the text to classify
- `priority` (optional) — same as `mind_chat`

**Output (JSON)**
```json
{
  "tier": "T1" | "T2" | "T3",
  "handler": "<handler name>",
  "params": { ... }
}
```

**Use this for** understanding *how* mind would treat a message before actually sending it. Cheap and side-effect-free.

---

### `mind_status`

Snapshot of supervisor state.

**Inputs** — none

**Output (JSON)**
```json
{
  "uptimeMinutes": ...,
  "services": [{name, port, status}, ...],
  "recentDecisions": [...],
  "sessionId": "..."
}
```

**Use this for** checking what mind is currently aware of, what services it's monitoring, and what decisions have been made recently.

---

### `mind_inbox`

Query the T3 escalation inbox — messages that were escalated to executive tier and need human attention.

**Inputs**
- `status` (`"pending"` | `"responded"` | `"all"`, optional) — defaults to `"pending"`

**Output (JSON)**
```json
{
  "count": N,
  "items": [{id, source, sender, text, status, queuedAt}, ...]
}
```

**Use this for** finding out what's waiting on you — messages that mind escalated rather than answered.

---

## Operational notes

### Stdio is the only transport

The MCP server speaks JSON-RPC over stdio. Anything written to stdout that isn't a JSON-RPC message will corrupt the protocol stream — that's why the boot banner goes to stderr (`[ai-mind mcp] v0.1.0 ready ...`). When debugging, watch stderr.

### Binding state is announced at boot

The stderr banner reports how many real vs. mock bindings are active. Use this to confirm your env vars are taking effect:

```
[ai-mind mcp] v0.1.0 ready (bindings: 0 real, 8 mock)   ← all defaults
[ai-mind mcp] v0.1.0 ready (bindings: 8 real, 0 mock)   ← MIND_USE_REAL=all
[ai-mind mcp] v0.1.0 ready (bindings: 2 real, 6 mock)   ← MIND_USE_REAL=llm,llmClient
```

### One process per agent

The server is single-instance per process. If you launch two Claude Code sessions both pointing at the same ai-mind config, they get two independent processes — each with its own mocks, its own inbox, its own state. They don't share. If you want shared state, run `ai-mind serve` (HTTP mode) and have both sessions hit the HTTP API instead.

### Adding more tools

Tools are registered in `presentation/mcp/server.js`. Each tool gets a `registerTool(name, config, handler)` call. Add a new tool there and document it here. Keep the surface small — every tool is a public API.

---

## Troubleshooting

**Claude Code says "no tools found":** restart Claude Code after editing `.mcp.json`. The MCP server only loads at session start.

**`mind_chat` returns `[mock] ...` even though you set `MIND_USE_REAL=llm`:** check the boot banner in stderr — if it still says "0 real, 8 mock", the env var didn't reach the spawned process. Some OS shells don't propagate env into npx subprocesses; try setting it in the `env` field of `.mcp.json` instead.

**Tool calls hang:** the server is waiting for a response from a real implementation that isn't reachable. Check that Ollama / your peer services are actually up. Or flip the binding back to mock to isolate.

**Process won't start:** the most common cause is a syntax error in your `.mcp.json` — Claude Code logs the parsing error in its own console. Fix the JSON, restart.

---

## See also

- `README.md` — the entry point with all three install modes
- `CONTRACTS.md` — what each binding does and how to swap real vs. mock
- `EXTRACTION_STRATEGY.md` — why the mockability promise exists
- `ARCHITECTURE.md` — what's actually behind these tools
- The MCP spec: https://modelcontextprotocol.io
