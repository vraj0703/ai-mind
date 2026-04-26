# ONBOARDING.md

How to install and run `ai-mind`. Three install modes × three operating modes — pick by use case.

The default install is **MCP server mode** (drop into Claude Code / Cursor / Codex). The default operating mode is **supervisor-of-self** (no peer services, all mocks). Together they're the zero-configuration path that makes ai-mind work right out of the box.

For *why* mockability is a first-class promise, see [`EXTRACTION_STRATEGY.md`](./EXTRACTION_STRATEGY.md). For *what* each binding does, see [`CONTRACTS.md`](./CONTRACTS.md). For the public surface in MCP mode specifically, see [`MCP-INTEGRATION.md`](./MCP-INTEGRATION.md).

---

## Quickstart — 90 seconds from clone to first decision

```bash
git clone https://github.com/vraj0703/ai-mind.git
cd ai-mind
npm install
node bin/ai-mind.js chat "/help"
```

Expected output:
```json
{
  "response": "Commands: /status /plan /know <q> /cron /help /mrv <msg> /urgent <msg> @planning @review @resources @design @cortex",
  "tier": "T1",
  "handler": "help",
  "model": null,
  "confidence": 1,
  "decisionId": "d-..."
}
```

If you got that, ai-mind is working. No external services. No env vars. No submodules. Move on to the install mode that fits your use case.

**Cold-validated install times** (Apr 2026, fresh clone on Windows + Git Bash):
- `git clone` — instant
- `npm install` — ~10s (29 packages, 0 vulnerabilities)
- `npm test` — ~260ms (161 tests pass)
- First `chat` invocation — ~250ms warm

---

## Install mode 1 — MCP server (PRIMARY)

For users of AI Agent CLIs. Most leverage per minute of setup.

### 1a. Add to `.mcp.json`

In your project root (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "ai-mind": {
      "command": "node",
      "args": ["I:/path/to/ai-mind/bin/ai-mind.js", "mcp"]
    }
  }
}
```

(npm publish for `npx ai-mind mcp` is tracked as a follow-up — the package name `ai-mind` may collide on npm, in which case it'll be `@vraj0703/ai-mind`. Until then, point at the absolute path of your clone.)

### 1b. Restart your AI agent

Claude Code, Cursor, Codex — all need a session restart after editing `.mcp.json`.

### 1c. Verify

In the AI agent, ask: *"Use mind_status to show the current supervisor state."*

You should get a JSON response with services / decisions / uptime. The four available tools are documented in [`MCP-INTEGRATION.md`](./MCP-INTEGRATION.md):
- `mind_chat` — send a message, get a routed decision
- `mind_route` — classify a message without executing
- `mind_status` — supervisor state snapshot
- `mind_inbox` — query the T3 escalation inbox

### Troubleshooting MCP

The MCP server speaks JSON-RPC on stdio. The boot banner goes to **stderr**:
```
[ai-mind mcp] v0.1.0 ready (bindings: 0 real, 8 mock)
```
If you don't see this in your agent's logs, the spawn failed — check your `args` path and that `node` is on PATH inside the agent's spawn environment.

---

## Install mode 2 — npx CLI (one-shot)

For shell scripting, quick experiments, or composing ai-mind with other Unix tools.

### Run any cognitive command from the shell

```bash
node bin/ai-mind.js chat "<message>"      # full route + decision
node bin/ai-mind.js status                # supervisor snapshot
node bin/ai-mind.js --help                # all commands
node bin/ai-mind.js --version
```

### Capture into pipelines

The output is JSON, parse with `jq` or anything else:

```bash
node bin/ai-mind.js chat "/status" | jq '.tier'         # → "T1"
node bin/ai-mind.js status | jq '.uptimeMinutes'        # → 0
```

### Git Bash gotcha (Windows)

Paths starting with `/` get rewritten by MSYS path conversion. If `node bin/ai-mind.js chat "/status"` returns T2 instead of T1, set:

```bash
MSYS_NO_PATHCONV=1 node bin/ai-mind.js chat "/status"
```

Or just call it from cmd.exe / PowerShell instead of Git Bash.

---

## Install mode 3 — HTTP server (long-running)

For raj-sadan, embedded use cases, or anything that wants to keep ai-mind hot in the background.

### Boot

```bash
node bin/ai-mind.js serve
# or equivalent: npm start
```

Expected boot output:
```
╔══════════════════════════════════════╗
║     ai-mind                          ║
║     Cognitive layer · clean arch     ║
╚══════════════════════════════════════╝

[ai-mind] bindings — real: [none]
[ai-mind] bindings — mock: [llm, llmClient, jobScheduler, serviceMonitor, planStore, stateWriter, alertChannel, contextProvider]
[ai-mind] supervisor-of-self mode (no peer services)
[mind-v2] listening on http://127.0.0.1:3486
```

### Hit the API

```bash
curl http://127.0.0.1:3486/health                       # liveness
curl http://127.0.0.1:3486/status                       # supervisor snapshot
curl -X POST http://127.0.0.1:3486/chat \
  -H 'Content-Type: application/json' \
  -d '{"source":"cli","sender":"you","payload":"/status"}'
```

Visualize topology in a browser: `http://127.0.0.1:3486/visualize`.

### Stop

`Ctrl+C` — handlers fire `SIGINT`, write a clean session, exit zero.

---

## Operating modes

The install mode picks where ai-mind runs. The operating mode picks what it monitors. They're orthogonal — pick one of each.

### Mode A — Supervisor-of-self (DEFAULT)

ai-mind has no peer services to monitor. The supervisor loop runs but has nothing external to watch over. Decisions still flow normally — chat works, routing works, escalations queue.

This is the default. Works zero-config. Use this for:
- AI agent embedding (Claude Code, Cursor)
- One-shot CLI work
- Tests
- Any case where ai-mind is the only ai-mind in the room

### Mode B — With peers (raj-sadan topology)

Set `MIND_PEER_SERVICES=raj-sadan-organs` and ai-mind monitors the raj-sadan organ mesh:

```bash
MIND_USE_REAL=all MIND_PEER_SERVICES=raj-sadan-organs node bin/ai-mind.js serve
```

Monitors:
- `memory` on :3488
- `senses` on :3487
- `knowledge` on :3489
- `dashboard` on :3491

### Mode C — Custom topology

Pass an explicit services list when constructing the container. Requires you to embed ai-mind as a library (rather than via the CLI):

```js
const { createContainer } = require('ai-mind/di/container');
const container = createContainer({
  services: [
    { name: 'my-thing', port: 9000, healthUrl: 'http://internal:9000/healthz' },
    { name: 'other-thing', port: 9001, healthUrl: 'http://internal:9001/health' },
  ],
  use: { llm: 'real' },
  ollamaHost: 'http://my-ollama:11434',
});
```

---

## Upgrading from mocks to real implementations

Default install: every binding is a mock. Replacing one with a real implementation is a single env var (or one line of config).

### One binding at a time

```bash
# Wire real Ollama only — everything else stays mock
MIND_USE_REAL=llm OLLAMA_HOST=http://localhost:11434 node bin/ai-mind.js serve

# Real LLM + real plan/state persistence
MIND_USE_REAL=llm,planStore,stateWriter MIND_PROJECT_ROOT=/path/to/your/work node bin/ai-mind.js serve
```

### All at once

```bash
MIND_USE_REAL=all OLLAMA_HOST=http://localhost:11434 \
MIND_PROJECT_ROOT=/path/to/your/work \
node bin/ai-mind.js serve
```

### What each binding needs from the outside

| Binding | If real, needs |
|---|---|
| `llm`, `llmClient` | A reachable Ollama (or compatible) at `OLLAMA_HOST` |
| `planStore`, `stateWriter` | A writable `MIND_PROJECT_ROOT/plans/` and `MIND_PROJECT_ROOT/state/` |
| `serviceMonitor` | Peer services on the configured ports |
| `jobScheduler` | A reachable cron service at `cronHost` (default `http://127.0.0.1:3479`) |
| `alertChannel` | A reachable WhatsApp gateway at `whatsappHost` (default `http://127.0.0.1:3478`) |
| `contextProvider` | Above bindings already wired (depends on planStore + serviceMonitor) |

For the deeper why and the per-binding swap reference, see [`CONTRACTS.md`](./CONTRACTS.md).

---

## Three most common gotchas

### 1. "I get T2 smart_triage when I expected T1 service_health"

Two causes:
- **Git Bash MSYS path conversion** rewrote `/status` → some Windows path. Use `MSYS_NO_PATHCONV=1` or run from cmd.exe.
- **Empty payload** — the classifier falls through to T2 default for unrecognized input. Check that your message text actually starts with `/status` or another T1 command.

### 2. "MCP server hangs at startup"

Stdio MCP servers wait for the agent to send the initialize request. If your agent never connects (wrong path in `.mcp.json`, wrong arg list, agent not restarted), the server appears to hang. Confirm the stderr banner appears when you launch — if it does, the server is healthy and waiting.

### 3. "I set MIND_USE_REAL=llm but `mind_chat` still returns `[mock]`"

Three things to check:
- The env var must reach the spawned process. Some shells don't propagate env into npx subprocesses; set it in the `env` field of `.mcp.json` rather than in your shell.
- The boot banner reports the active state — `[ai-mind mcp] v0.1.0 ready (bindings: 1 real, 7 mock)` — if it says 0 real, the var didn't land.
- `OLLAMA_HOST` must point at a running Ollama. If the real LLM call fails, the result surfaces as an error, not a silent fallback to mock. (No silent fallbacks — see EXTRACTION_STRATEGY.md.)

---

## Verifying everything works

Run the smoke test suite. It's the executable proof of the mockability contract.

```bash
npm run test:smoke
# → 12 tests pass
```

If those go red, the zero-submodule install promise is broken. File an issue.

---

## Future install paths

These are tracked as follow-ups, not blocking adoption:

- **`npx ai-mind mcp`** — once the npm name is decided (`ai-mind` or `@vraj0703/ai-mind`) and published.
- **Docker image** — for users who don't want a Node toolchain locally.
- **One-shot install script** — `curl ... | bash` style. Would need to settle the npm path first.

For now, `git clone + npm install + node bin/ai-mind.js` is the canonical install. It takes ~10 seconds and works on every platform Node runs on.

---

## Going deeper

- [`README.md`](./README.md) — entry point, multi-audience overview
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how ai-mind is built, with diagrams
- [`CONTRACTS.md`](./CONTRACTS.md) — per-binding interface specs and swap recipes
- [`MCP-INTEGRATION.md`](./MCP-INTEGRATION.md) — MCP-specific details (the four tools)
- [`EXTRACTION_STRATEGY.md`](./EXTRACTION_STRATEGY.md) — why mockability is a shipping promise
- [`AUDIT.toml`](./AUDIT.toml) — every external coupling and how it's classified
- [`audit/`](./audit/) — security audit reports
