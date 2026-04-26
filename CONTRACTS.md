# CONTRACTS.md

Every external dependency `ai-mind` could otherwise reach for has an interface contract and a default mock implementation. This file is the per-binding reference: what each interface abstracts, what its default mock returns, and how to swap to a real implementation.

For the *why* (architecture, mockability strategy, swap mechanism), see `EXTRACTION_STRATEGY.md`.

For the *audit* that drove the binding list, see `AUDIT.toml`.

---

## How to use this document

- **Browsing:** every binding has its own section with the same structure (Interface · Default mock · Real impl · Swap recipes).
- **Adding a new binding:** add the interface to `domain/repositories/i_*.js`, add the mock to `data/repositories/mocks/`, register both in `di/container.js`, then document here.
- **Verifying:** the `tests/zero_submodule_smoke.test.js` suite must stay green.

---

## The 8 bindings at a glance

| Binding | Interface | Default mock | Real impl |
|---|---|---|---|
| `llm` | `ILLMProvider` | `StubLLMProvider` | `OllamaLLMRepository` |
| `llmClient` | `ILLMClient` | `StubLLMClient` | `OllamaLLMClient` |
| `jobScheduler` | `IJobScheduler` | `InMemoryJobScheduler` | `HttpJobScheduler` |
| `serviceMonitor` | `IServiceMonitor` | `NoopServiceMonitor` | `HTTPServiceMonitor` |
| `planStore` | `IPlanStore` | `InMemoryPlanStore` | `TOMLPlanStore` |
| `stateWriter` | `IStateWriter` | `InMemoryStateWriter` | `FileStateWriter` |
| `alertChannel` | `IAlertChannel` | `ConsoleAlertChannel` | `WhatsAppAlertChannel` |
| `contextProvider` | `IContextProvider` | `StaticContextProvider` | `ContextAssembler` |

All bindings default to mock. Flip per-binding via `createContainer({ use: { <binding>: 'real' } })` or via env `MIND_USE_REAL=binding1,binding2` (or `=all`).

---

## `llm` — LLM completion

**Interface:** `domain/repositories/i_llm_provider.js`
**Default mock:** `data/repositories/mocks/stub_llm_provider.js`
**Real impl:** `data/repositories/ollama_llm_repository.js`

Mind calls this whenever a use case needs to generate text — routing decisions, message processing, focus brief drafting.

The mock returns deterministic, pattern-matched responses prefixed with `[mock]`. It handles `/status`, `/help`, `/<command>`, JSON-format requests, and falls back to an `[mock] Echo: <input>` for free-form prompts. Smart enough for tier-1 commands and tests; deliberately not smart enough to pretend it's a real LLM.

**Swap to real:**
```js
createContainer({ use: { llm: "real" }, ollamaHost: "http://localhost:11434" });
// or
MIND_USE_REAL=llm OLLAMA_HOST=http://localhost:11434 node index.js
```

The real implementation needs a running Ollama server. If you want a different LLM provider, write a class implementing `ILLMProvider` and inject it: `createContainer({ use: { llm: new MyClaudeProvider() } })`.

---

## `llmClient` — Lower-level LLM client

**Interface:** `domain/repositories/i_llm_client.js`
**Default mock:** `data/repositories/mocks/stub_llm_client.js`
**Real impl:** `data/data_sources/remote/ollama_llm_client.js`

Distinct from `llm` — this is the raw HTTP-shaped client (`{ text, tokens, elapsedMs }`). Used where mind wants direct control over the inference call.

The mock returns the same shape with a `[mock]` prefix; supports JSON format mode.

**Swap to real:** `createContainer({ use: { llmClient: "real" } })`.

---

## `jobScheduler` — Cron-style background jobs

**Interface:** `domain/repositories/i_job_scheduler.js`
**Default mock:** `data/repositories/mocks/in_memory_job_scheduler.js`
**Real impl:** `data/data_sources/remote/http_job_scheduler.js`

Mind uses this when it needs to schedule recurring or deferred work (audit runs, summary generation, periodic reports).

The mock holds jobs in a `Map`. It does NOT fire on a schedule — `triggerJob` is the only way to "run" one. For tests and tier-1 ops this is fine; you don't need real time-based execution to validate the cognitive flow.

The mock exposes a test-only `registerJob(key, schedule, payload)` so you can pre-seed jobs to find via `triggerJob`.

**Swap to real:** `createContainer({ use: { jobScheduler: "real" }, cronHost: "http://127.0.0.1:3479" })`.

---

## `serviceMonitor` — Health checks + restarts

**Interface:** `domain/repositories/i_service_monitor.js`
**Default mock:** `data/repositories/mocks/noop_service_monitor.js`
**Real impl:** `data/repositories/http_service_monitor.js`

Mind's supervisor uses this to watch over peer services. It calls `checkAll(services)` on each tick, and `restart(service)` when it decides to recover one.

The mock reports every service as healthy and returns success on every restart call without doing anything. Combined with an empty `services` array (the default), this means the supervisor loop becomes a quiet heartbeat with nothing to monitor.

**Two operating modes worth knowing:**

1. **Supervisor-of-self (default):** pass `services: []` (or omit). The mock is fine; there's nothing to check.
2. **Real monitoring:** pass `services: [{name, port, healthUrl}, ...]` and `use: { serviceMonitor: "real" }`. Real HTTP health checks fire on each tick.

**Swap to real:** `createContainer({ use: { serviceMonitor: "real" }, services: [...] })`.

---

## `planStore` — Plan + task persistence

**Interface:** `domain/repositories/i_plan_store.js`
**Default mock:** `data/repositories/mocks/in_memory_plan_store.js`
**Real impl:** `data/repositories/toml_plan_store.js`

Mind reads plans to evaluate available tasks; updates task status after execution.

The mock is an in-memory `Map`. Empty by default; `new InMemoryPlanStore({ seed: [...] })` accepts pre-loaded plans for tests.

**Swap to real:** `createContainer({ use: { planStore: "real" }, projectRoot: "/path/to/raj_sadan" })`. The real implementation reads `<projectRoot>/plans/*.toml`.

---

## `stateWriter` — Session, heartbeat, decision log

**Interface:** `domain/repositories/i_state_writer.js`
**Default mock:** `data/repositories/mocks/in_memory_state_writer.js`
**Real impl:** `data/repositories/file_state_writer.js`

Mind writes session state on shutdown, heartbeats on each supervisor tick, and decisions to an append-only log.

The mock captures everything in arrays and exposes `getSessions()` / `getHeartbeats()` / `getDecisions()` for test assertions. Nothing touches the filesystem.

**Swap to real:** `createContainer({ use: { stateWriter: "real" }, projectRoot: "/path/to/raj_sadan" })`.

---

## `alertChannel` — Outbound alerts

**Interface:** `domain/repositories/i_alert_channel.js`
**Default mock:** `data/repositories/mocks/console_alert_channel.js`
**Real impl:** `data/repositories/whatsapp_alert_channel.js`

Mind escalates via this when a service is down for too long, a plan is blocked, or PM attention is needed.

The mock writes to `console.log` with a `[mock-alert <priority> → <target>]` prefix. For tests, pass `new ConsoleAlertChannel({ sink: capturingFn })` to suppress console output and assert on `getSent()`.

**Swap to real:** `createContainer({ use: { alertChannel: "real" }, whatsappHost: "http://127.0.0.1:3478" })`.

---

## `contextProvider` — Context assembly

**Interface:** `domain/repositories/i_context_provider.js`
**Default mock:** `data/repositories/mocks/static_context_provider.js`
**Real impl:** `data/repositories/context_assembler.js`

Mind asks for full context when it needs to make a decision — plans, capabilities, service health, cognitive state, resources. The real assembler stitches this from multiple sources.

The mock returns a fixed, plausible Context with `mock: true` set. Useful for tier-1 commands and tests that need *some* context but don't care if it's synthetic.

**Swap to real:** `createContainer({ use: { contextProvider: "real" }, projectRoot: "/path/to/raj_sadan", services: [...] })`. The real assembler depends on `planStore` and `serviceMonitor`, so flipping it real usually means flipping those too.

---

## Patterns that recur

### Mock outputs are tagged
Every mock that produces user-visible output prefixes it with `[mock]` (LLM responses) or `[mock-<thing>]` (alerts). A reader should never wonder if a response came from a real service.

### Mocks expose test-only helpers
`InMemoryStateWriter.getSessions()`, `ConsoleAlertChannel.getSent()`, `InMemoryJobScheduler.registerJob()` — these aren't part of the interface; they're on the concrete class so tests can pre-seed and assert. Don't depend on these from production code.

### No partial-real bindings
A binding is either fully real or fully mock. There's no "real with mock fallback" mode. If you ask for `llm: "real"` and Ollama is down, the call fails loudly. This is deliberate — silent fallbacks compound failure modes invisibly.

### Backwards-compat at the boot layer, not the contract layer
`raj-sadan` boots ai-mind with `MIND_USE_REAL=all MIND_PEER_SERVICES=raj-sadan-organs node index.js`. That's where the "I want everything real" decision lives. The contract layer (this document) doesn't know about specific deployments.

---

## See also

- `EXTRACTION_STRATEGY.md` — the *why* (submodule + mockability framework)
- `AUDIT.toml` — the input list (every coupling, classified)
- `tests/zero_submodule_smoke.test.js` — the executable proof of this contract
- `domain/repositories/i_*.js` — the interface definitions themselves
