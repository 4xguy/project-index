# Semantic Search Design (Draft)
Date: 2025-11-22
Branch: feature/semantic-semsearch-design

## Goals
- Add intent-based retrieval to complement exact symbol search.
- Keep defaults lightweight/offline-friendly; semantic is opt-in.
- Minimal code changes first: embed top-level symbols during `index` and query via new CLI.

## Scope (Phase 1)
- Embed top-level symbols (exports, React components, API endpoints, classes/functions) plus file-level summaries.
- Store vectors locally; no server required.
- CLI command: `project-index semsearch <query> [--k 20] [--scope symbols|files|both] [--lang ts|py|go|rust|sh] [--json]`.
- Optional `--semantic` flag on `suggest` to blend vector scores with existing heuristics.

## Model Options
**Default (local, small)**
- Model: `intfloat/e5-small-v2` (384-d). Good quality/size balance; common license.
- Runtime: Node via `@xenova/transformers` (pure JS, no GPU required).

**Alternative (cloud)**
- Any embedding API (e.g., OpenAI text-embedding-3-small); behind config `semantic.provider=openai` and `SEMANTIC_API_KEY`.
- Never enabled by default; requires env var.

## Storage Format
- File: `.context/.project/PROJECT_INDEX.vectors.jsonl`
- Record fields:
  - `id`: stable symbol id (e.g., `src/core/indexer.ts:ProjectIndexer.indexProject`)
  - `type`: `symbol` | `file`
  - `lang`: `ts` | `py` | `go` | `rs` | `sh`
  - `text`: source text used for embedding (for regen/debug)
  - `vector`: float32 array (serialized as base64 or compact JSON array)
  - `updatedAt`: ISO timestamp
- Metadata header in same file: `{ "version": 1, "model": "...", "dim": 384 }`.

## Index Pipeline Changes
- During `project-index index`:
  1) Build current symbol list (already done).
  2) For each top-level symbol, create embedding text:
     - `name + kind + signature + doc + file path`
  3) For each file, build short summary text (imports/exports/react/api counts).
  4) Generate embeddings in batches; write/overwrite JSONL.
- Invalidate/regenerate on file change. If semantic disabled, skip step entirely.

## Query Flow (`semsearch`)
1) Load vectors (fail fast if missing and semantic disabled).
2) Embed query with same model.
3) Cosine similarity; top-k filtering by scope/lang if provided.
4) Output:
   ```json
   {
     "query": "...",
     "model": "...",
     "matches": [
       {"id":"src/core/indexer.ts:ProjectIndexer.indexProject","score":0.73,"type":"symbol","file":"src/core/indexer.ts","line":56},
       ...
     ]
   }
   ```

## Config Surface
- `semantic.enabled` (default false)
- `semantic.provider` = `local` | `openai`
- `semantic.model` (default `intfloat/e5-small-v2`)
- `semantic.kDefault` (default 20)
- Env var override: `SEMANTIC_ENABLED=1`, `SEMANTIC_PROVIDER=openai`, `SEMANTIC_API_KEY=...`

## CLI Additions
- `project-index semsearch <query>` (new command)
- `project-index suggest --semantic` (optional flag blending scores)

## Tests (Phase 1)
- Fixture index of `test-resources-simple.js` + TS fixture: assert semsearch returns the known symbol with score > 0.5.
- Schema test: vectors file contains header + entries; `model`, `dim` match config.

## Risks & Mitigations
- **Perf**: embedding during index could slow large projects. Mitigate with opt-in flag and batch size.
- **Size**: vectors grow with symbols; consider pruning to top-level only (Phase 1). Add `maxSymbols` config later.
- **Platform**: @xenova/transformers bundles WASM; ensure build step copies assets. Provide cloud fallback if WASM fails.

## Phase 2 (optional, later)
- Add HNSW (faiss-lite or hnswlib-node) for large repos.
- Add per-language weighting; expand to call-graph aware reranking.
- Add background watcher to refresh embeddings on change.
