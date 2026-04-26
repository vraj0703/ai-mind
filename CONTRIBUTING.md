# Contributing to ai-mind

Thanks for the interest. The codebase is small (a few thousand lines), well-documented, and designed to be readable in an afternoon. This guide is the minimum you need to be productive.

## Dev setup

```bash
git clone https://github.com/vraj0703/ai-mind.git
cd ai-mind
npm install
npm test          # 161 tests should pass; runs in <300ms
npm start         # boots on http://127.0.0.1:3486
```

No build step. No transpile. JavaScript with JSDoc comments — your editor handles the rest.

## Test conventions

- **Tests live next to the code they test.** `domain/use_cases/route_input.js` has its tests in `domain/use_cases/route_input.test.js`. Same for `data/repositories/`.
- **Use `node --test`** (the built-in runner). No Jest, no Mocha. Test file naming: `<thing>.test.js`.
- **No tests touch the network or wait on a real model.** If a feature can't be tested cheaply, the design is probably wrong — talk to a maintainer first.
- **The mockability smoke test is load-bearing.** `tests/zero_submodule_smoke.test.js` proves the zero-submodule install promise. It must stay green on every PR.

## The invariants (please don't break these)

1. **Domain doesn't `require()` anything from `data/`, `presentation/`, or `di/`.** If your change adds such an import, it's a bug. The audit (`AUDIT.toml`) confirms zero violations today; keep it that way.
2. **Every new external dependency gets an interface, a mock, and a real implementation — in that order.** Read `CONTRACTS.md` before adding a binding.
3. **No partial-real bindings.** A binding is fully real or fully mock; no "real with mock fallback" hybrids. The reasoning is in `EXTRACTION_STRATEGY.md`.
4. **No global mutable state.** Use cases are functions; controllers hold their own state explicitly; the container is constructed once at boot.

## PR conventions

- **One logical change per PR.** Big PRs get split.
- **Description should explain *why*, not just *what*.** The diff already shows what.
- **Add or update tests.** PRs that add behavior without tests will be asked to add them.
- **Update docs that the change makes stale.** README, ARCHITECTURE, CONTRACTS, AUDIT — whichever is affected.
- **CI must pass.** `npm test` runs on every PR; PRs that fail this don't merge.
- **Conventional commit subject lines** are nice-to-have: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Not enforced.

## Commit signing

Not required.

## Reporting issues

Open a GitHub issue. Include:
- What you expected to happen
- What actually happened
- Reproduction steps (the minimum invocation that triggers the issue)
- Node version, OS, mode (HTTP / MCP / CLI), real/mock binding state if relevant

## Asking questions

Open a GitHub Discussion (or issue tagged `question`). The codebase is small; if a question takes more than a paragraph to answer, the docs probably have a gap.

## License

By contributing, you agree your contributions are licensed under the project's MIT license (`LICENSE`).
