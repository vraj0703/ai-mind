# Changelog

All notable changes to `ai-mind` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] — 2026-04-29

### Changed (BREAKING — npm scope)

- **Renamed npm package from `ai-mind` to `@raj-sadan/ai-mind`** to match the project's npm org. Update install: `npm install @raj-sadan/ai-mind`.
- `release.yml` extended to wire `npm publish --access public --provenance` (was previously a placeholder building only GitHub Releases).
- `publishConfig` added: `access: public`, `provenance: true`.

### Note

v0.1.0 existed only as a GitHub tag (never published to npm). v0.1.1 is the first npm publish under any name.

## [0.1.0] — 2026-04-26

First public release. Extracted from [raj-sadan](https://github.com/vraj0703/raj-sadan) as a standalone cognitive layer.

### Added

- **Core cognitive layer.** Three-tier classifier (T1 instant / T2 local LLM / T3 escalate-to-human), 11 use cases, 9 entities, 8 repository interfaces — all under `domain/` with zero outward dependencies.
- **Mockability contract.** Every external dependency has a default in-tree mock. `git clone && npm install && npm start` produces a working service with no submodules pulled, no env vars set, no external services running. Spec'd in `CONTRACTS.md`; verified by `tests/zero_submodule_smoke.test.js`.
- **Three install modes.** HTTP server (`npm start`, port 3486), MCP server (`npx ai-mind mcp` — for Claude Code / Cursor / Codex), CLI (`npx ai-mind <command>`).
- **Three runtime modes.** Supervisor-of-self (default, no peers), with peers (raj-sadan organ topology), custom topology (any service list).
- **Documentation.** `README.md` (multi-audience progressive structure), `ARCHITECTURE.md` (5 mermaid diagrams + prose), `EXTRACTION_STRATEGY.md` (why submodule + mockability), `CONTRACTS.md` (per-binding spec), `AUDIT.toml` (external-coupling inventory).
- **Tests.** 161 passing — 149 domain use-case tests + 12 mockability smoke tests. Zero network, zero model dependency.

### Decisions

- Submodule (not subtree) for the extraction. See `EXTRACTION_STRATEGY.md`.
- Mocks default; opt into real implementations via `MIND_USE_REAL=...` env or `createContainer({ use: { ... } })` config.
- JSDoc instead of TypeScript — type-checked by editors, no transpile step.
- Express 5 + plain `node --test` — minimal dependency footprint.

### Known limitations

- Stub LLM is intentionally simple (pattern matcher + echo); not meant to pass for a real model.
- MCP wrapper not yet shipped — `npx ai-mind mcp` is a tracked work item (RAJ-42).
- npm package name `ai-mind` may collide; if so, the published name will be `@vraj0703/ai-mind`.

[Unreleased]: https://github.com/vraj0703/ai-mind/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vraj0703/ai-mind/releases/tag/v0.1.0
