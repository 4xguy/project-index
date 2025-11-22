# Warm Server & Semantic Performance Plan (Reference)
Date: 2025-11-22  
Branch: feature/semantic-semsearch-design

## Goals
- Cut perceived latency by keeping index + embeddings warm in a resident process.
- Add caching so semantic runs don’t recompute embeddings unnecessarily.
- Collect timings to decide if a native (Go/Rust) sidecar is warranted.

## Work Items (do in order)
1) **Server mode**
   - Add `project-index serve` (HTTP or stdio) that preloads index and embedding model once.
   - Expose endpoints for `search`, `semsearch`, `deps`, `impact`, `suggest`.
   - Keep index and embedding vectors in memory across requests.

2) **Embedding cache**
   - Store vectors in `.context/.project/PROJECT_INDEX.vectors.jsonl` with header `{model, dim, version}`.
   - On index update, regenerate vectors only for changed files/symbols; reuse cache otherwise.

3) **CLI auto-forward**
   - CLI commands first try the running server; fall back to current local execution if the server is absent.

4) **Timings & diagnostics**
   - Add `--trace-timings` flag to log per-command durations (cold vs warm).
   - Instrument server handlers to emit p50/p95/p99 locally (simple moving window).

5) **Benchmark & record**
   - Collect before/after p50/p95/p99 for `search`, `semsearch`, `suggest` on a representative repo.
   - Record results in-repo (e.g., `benchmarks/semsearch-warm.md`).

6) **Decision gate for native sidecar**
   - Target: warm p99 ≤ ~80–100 ms for `search/semsearch/suggest`.
   - If above target and CPU-bound after warm server + cache, prototype a small Go/Rust sidecar for embeddings + ANN.
   - If targets met, skip native port.

## Notes
- Model default stays `Xenova/all-MiniLM-L6-v2`; warm server preloads it once.
- Server should be opt-in; defaults stay lightweight.
- Keep existing behaviors unchanged when server is not running.
