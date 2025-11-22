# Project Index Improvement Plan (2025-11-22)

## Weak Spots Observed
- Staleness: index relies on manual runs; risk of outdated dependency/call graphs.
- Minimal safety net: zero automated tests; parser regressions undetected.
- Native fragility: tree-sitter rebuild requirements can bite new devs.
- No semantic/embedding search (out of scope here but noted).

## Goals (near-term)
1. Auto-refresh index on change to reduce staleness.
2. Add minimal automated tests to guard CLI and parsers.
3. Bake env guards to keep tree-sitter rebuilds reliable.

## Work Items (TODO)
- [ ] Auto-index hook
  - [ ] Add `postinstall` script: `npm run build && project-index index .` (or guard with env var like `SKIP_INDEX`).
  - [ ] Add optional file watcher mode in README: `project-index watch .` as background service.
  - [ ] Consider git hook sample (`.husky/pre-commit`) to run `project-index index .` for modified paths.

- [ ] Minimal tests
  - [ ] CLI smoke: `project-index status .` and `project-index search ProjectIndexer` via `npx jest --runInBand` using snapshot of `.context/.project/PROJECT_INDEX.json`.
  - [ ] Parser sanity: add fixtures under `test/fixtures/{ts,py,go,rust,sh}` and assert symbol counts >0 and key symbols present.
  - [ ] Integration: run `project-index index test/fixtures` and assert JSON schema (files >0, symbols >0).

- [ ] Env reliability
  - [ ] Add CI matrix for Node 20 (GitHub Actions) with `npm ci --legacy-peer-deps`, `npm run build`, `npm test`.
  - [ ] Cache native builds or run `npm rebuild tree-sitter tree-sitter-go tree-sitter-rust --build-from-source` in CI to surface ABI issues early.
  - [ ] Document fast-fail check: `node -e "require('tree-sitter-go');require('tree-sitter-rust');console.log('ts ok')"` in README.

## Definition of Done
- CLI global install works on Node 20 via nvm; `project-index status .` passes.
- Automated tests green locally and in CI.
- Auto-index guidance present and optional hook available.
