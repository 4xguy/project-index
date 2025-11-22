PROJECT-INDEX VALIDATION TODO (as of 2025-11-22T06:49:23Z)

- [x] Install locked dependencies to clear type errors  
  Command: `npm ci`  
  Note: requires network/package registry access.

- [x] Ensure native build toolchain for tree-sitter is present  
  Command (Debian/Ubuntu): `sudo apt-get update && sudo apt-get install -y build-essential python3 pkg-config`  
  Purpose: compile Go/Rust tree-sitter bindings.

- [x] Pin and use Node 20 LTS for native module compatibility  
  Commands: `nvm install 20 && nvm use 20`  
  Follow-up: add `.nvmrc` with the chosen 20.x version after confirming it works.

- [x] Rebuild native bindings after toolchain/Node are in place  
  Command: `npm rebuild tree-sitter tree-sitter-go tree-sitter-rust --build-from-source`

- [x] Re-run validation suite to confirm CLI and MCP server start  
  Command: `npm run validate` (or the same script that produced `validate-run-results.md`)  
  Status: Ran `npm run build` and `project-index status .` under Node 20; tree-sitter modules load and CLI responds.

- [x] Upgrade JS deps to current stable  
  - `commander` → ^14.0.2  
  - `ts-morph` → ^26.0.0  
  - `tree-sitter-go` → ^0.25.0  
  - kept `tree-sitter` at ^0.25.0; `tree-sitter-rust` stays 0.24.0

- [x] Bump TypeScript toolchain to match ts-morph  
  - `typescript` devDep → ^5.8.3  
  - verify `ts-jest` compatibility; update if needed.

- [x] Reinstall + rebuild after version bumps  
  Commands: `nvm use 20 && npm install --legacy-peer-deps && npm rebuild tree-sitter tree-sitter-go tree-sitter-rust --build-from-source && npm run build`

- [x] Run targeted sanity checks  
  - `project-index index .` then `project-index search <symbol>` ✅  
  - `npx jest --runInBand --passWithNoTests` (no tests present; baseline execution ok)

- [x] Document new version pins and prerequisites  
  Updated `VALIDATION_QUICK_REFERENCE.md` with Node 20, toolchain, install/rebuild commands.

- [x] Document env prerequisites to prevent future drift  
  Updated `README.md` with Node 20 + build tools + install/rebuild steps.

- [ ] Execute improvement plan (see PROJECT_INDEX_IMPROVEMENT_PLAN.md)  
  - Auto-index hook options (postinstall/watch/git hook)  
  - Minimal Jest smoke + parser fixtures  
  - CI for Node 20 with rebuild step

- [ ] Warm server + caching rollout (semantic/perf)
  - [ ] Add `project-index serve` (HTTP or stdio) that preloads index and embeddings, exposes search/semsearch/deps/impact/suggest.
  - [ ] Add embedding cache file `.context/.project/PROJECT_INDEX.vectors.jsonl`; regenerate deltas only for changed files.
  - [ ] Add CLI auto-forward to server if running; fallback to current behavior if not.
  - [ ] Add `--trace-timings` to log per-command durations (cold vs warm).
  - [ ] Benchmark p50/p95/p99 for search/semsearch/suggest before & after; record in repo.
  - [ ] Decision gate: if warm p99 > target (e.g., 80–100 ms) and CPU-bound, prototype native sidecar (Go/Rust) for embeddings+ANN; otherwise skip.
