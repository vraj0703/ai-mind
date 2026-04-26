# EXTRACTION_STRATEGY.md

How `ai-mind` is split out of `raj-sadan` and what guarantees it carries about working standalone.

---

## TL;DR

- **Strategy:** git submodule. Each part of raj-sadan that warrants independent versioning becomes its own git repo and is consumed back as a submodule.
- **Mockability is a shipping promise:** every external dependency `ai-mind` would otherwise reach for has a default mock implementation in-tree. A user runs `git clone && npm install && npm start` and gets meaningful behavior with **zero submodules pulled**.
- **Real implementations are opt-in:** swap a single DI binding (or set one env var) and the same code path uses the real Ollama / Cron / WhatsApp / Senses / Memory / etc.

---

## Why submodule (not subtree)

Two viable git strategies were considered.

| | Submodule | Subtree split |
|---|---|---|
| Independent VCS per part | ✅ each repo has its own log | ❌ history is rolled into one |
| Cheap to set up | ✅ `git submodule add` | ❌ requires `git filter-repo` runs |
| Consumer dance | ⚠️ dual-commit on cross-cuts | ✅ one log to commit to |
| Mockable substitution | ✅ submodule can be omitted entirely | ⚠️ harder — code is "always there" |
| PM directive (2026-04-26) | ✅ "different version control for different parts" | ❌ "we have only one version control" |

Submodule wins for `ai-mind` because the PM directive is explicit and because submodule pairs naturally with the mockability guarantee — a missing submodule isn't a broken dependency, it's the default state.

This is the same pattern previously used for `cortex-ai-supervisor` and `node-security-toolkit` lifts.

---

## The mockability contract

`ai-mind` ships with a complete in-tree mock implementation for every external dependency it could otherwise reach for. The contract holds three guarantees:

1. **Zero-submodule install works.** A fresh `git clone` + `npm install` + `npm start` produces a running service that responds meaningfully to API calls. No external services running. No submodules pulled. No environment variables set.
2. **Tests pass with mocks alone.** The `~268` existing tests (and any new ones) exercise the mock path by default. CI doesn't need Ollama, WhatsApp, or anything else.
3. **Swap is local and atomic.** Replacing a mock with a real implementation is one config edit (or one env var). No code changes. No reinstall. The interface is identical; only the binding differs.

### Coverage (per `AUDIT.toml`)

| Coupling | Class | Default mock |
|---|---|---|
| Ollama LLM (`ILLMProvider`) | MOCKABLE | `StubLLMProvider` — pattern-matches known prompts, returns deterministic responses |
| Ollama LLM client (`ILLMClient`) | MOCKABLE | `StubLLMClient` — same idea, lower-level interface |
| Cron jobs (`IJobScheduler`) | MOCKABLE | `InMemoryJobScheduler` — stores jobs in a Map, no time-based firing |
| WhatsApp alerts (`IAlertChannel`) | MOCKABLE | `ConsoleAlertChannel` — `console.log` with structured prefix; tests can capture |
| Senses observe | MOCKABLE | `NoopSensesPort` — accepts observations, drops them; `lastObservation` for tests |
| Plan store (`IPlanStore`) | MOCKABLE | `InMemoryPlanStore` — empty by default, accepts seed via constructor |
| State writer (`IStateWriter`) | MOCKABLE | `InMemoryStateWriter` — append to array; `getEntries()` for tests |
| Context (`IContextProvider`) | MOCKABLE | `StaticContextProvider` — returns canned but plausible context |
| Sibling-organ health monitor | OPTIONAL | Pass `services: []` — supervisor monitors nothing; supported mode |

---

## The interface boundary

`ai-mind` already separates its concerns cleanly. **Interfaces live in `domain/repositories/`** (per clean architecture — domain owns its contracts) and **implementations live in `data/repositories/`**. The DI container in `di/container.js` is the only place that knows about concrete classes.

```
mind/
├── domain/
│   └── repositories/                ← interfaces (the contracts)
│       ├── i_llm_provider.js
│       ├── i_alert_channel.js
│       ├── i_plan_store.js
│       └── ... (8 total)
├── data/
│   └── repositories/                ← real implementations
│       ├── ollama_llm_repository.js
│       ├── whatsapp_alert_channel.js
│       ├── toml_plan_store.js
│       └── mocks/                   ← default mock implementations
│           ├── stub_llm_provider.js
│           ├── console_alert_channel.js
│           ├── in_memory_plan_store.js
│           └── ... (8 total)
└── di/
    └── container.js                 ← binds interfaces → implementations
```

The audit (`AUDIT.toml`) found **zero** source-code imports from `mind/` reaching outside `mind/`. The interface boundary is already perfect; the work is just adding the mock side and flipping defaults.

---

## The swap mechanism

A single config field at container construction picks real vs mock for each binding. Three ways to set it, in increasing order of intentionality:

### 1. Default — everything mock
```js
const c = createContainer();              // every binding → mock
c.llm.complete(...)                       // → StubLLMProvider
```

### 2. Per-binding override via config
```js
const c = createContainer({
  llm: 'real',                            // → OllamaLLMRepository
  alertChannel: 'real',                   // → WhatsAppAlertChannel
  // others stay mock
});
```

### 3. Programmatic injection (advanced)
```js
const c = createContainer({
  llm: new MyCustomLLMProvider(...),      // accepts an instance directly
});
```

For env-var-only deployments (raj-sadan boots this way), a single `MIND_USE_REAL=llm,alert,plan,state` lists which bindings to flip. Empty / unset = all mocks.

---

## Why this matters

Three audiences benefit from the mockability contract.

**1. AI Agent CLI users** (Claude Code / Cursor / Codex). They want to drop `ai-mind` into their `.mcp.json` and have it just work. They don't care about Ollama or WhatsApp; they want cognitive primitives. Mocks make this an `npx ai-mind mcp` away.

**2. CI / automated tests.** Real services in CI are flaky, slow, and expensive. Mocks make every test deterministic and free.

**3. raj-sadan itself.** When raj-sadan boots, it explicitly opts into the real bindings it needs. Mocks let development happen without the full mesh running. The default state (all mocks) is the "I'm working on the cognitive layer alone today" state.

---

## What this strategy refuses to do

- **No silent fallback from real → mock.** If you ask for a real implementation and the service is down, the operation fails loudly. Mocks are a deployment choice, not a fault-tolerance mechanism.
- **No mock that pretends to be real.** Mocks should look obviously synthetic in their outputs (e.g., `[mock]` prefixes in alert messages). A user reading the response should never wonder if it came from a real LLM.
- **No partial-real bindings.** A binding is either fully real (talks to the actual service) or fully mock. No "real with mock fallback" hybrids — those compound failure modes invisibly.

---

## Open questions

- **npm scoping.** `ai-mind` is generic enough that there may be name collisions on npm. If so, we publish under `@vraj0703/ai-mind` and the binary stays `ai-mind`.
- **Mock sophistication ceiling.** The `StubLLMProvider` mock handles tier-1 commands and a small set of conversational patterns. It deliberately does *not* try to be a real LLM. If a user wants smart responses, they wire a real provider.
- **Future organs.** When `senses`, `memory`, `knowledge`, `dashboard` go through this same lift, they each carry the same contract — and `ai-mind`'s `NoopSensesPort` mock becomes "the thing you'd swap for `senses` v1."

---

## See also

- `AUDIT.toml` — the input that drove this strategy (RAJ-17)
- `CONTRACTS.md` — per-interface mock specs and swap recipes (RAJ-41)
- `ONBOARDING.md` — how a user actually runs all this (RAJ-22)
