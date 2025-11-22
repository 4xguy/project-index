#!/usr/bin/env node
import http from 'http';
import { ProjectIndexer } from './core/indexer';
import { semanticSearchWithCache, buildDocCache, DocCache, readCache, writeCache } from './semantic/semsearch';
import { createConfig } from './util/config';

const PORT = Number(process.env.PROJECT_INDEX_PORT || 4545);
const HOST = process.env.PROJECT_INDEX_HOST || '127.0.0.1';
const TRACE = !!process.env.PROJECT_INDEX_TRACE;

interface ServerState {
  indexer: ProjectIndexer;
  cache: DocCache | null;
  projectRoot: string;
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function ensureCache(state: ServerState) {
  if (state.cache) return state.cache;
  const index = state.indexer.loadIndex();
  if (!index) throw new Error('Index not found; run project-index index');
  const disk = readCache(state.projectRoot);
  if (disk) {
    state.cache = disk;
    return disk;
  }
  state.cache = await buildDocCache(index, state.projectRoot);
  writeCache(state.projectRoot, state.cache);
  return state.cache;
}

async function handleSearch(state: ServerState, req: any, res: http.ServerResponse, body: any) {
  const { query, exact } = body || {};
  if (!query) return send(res, 400, { error: 'query required' });
  const index = state.indexer.loadIndex();
  if (!index) return send(res, 404, { error: 'No index found' });
  const results = Object.entries(index.symbolIndex).filter(([symbol]) =>
    exact ? symbol === query : symbol.toLowerCase().includes(String(query).toLowerCase())
  );
  send(res, 200, { query, results: results.map(([symbol, location]) => ({ symbol, location })) });
}

async function handleSemSearch(state: ServerState, req: any, res: http.ServerResponse, body: any) {
  const { query, k, model } = body || {};
  if (!query) return send(res, 400, { error: 'query required' });
  try {
    const cache = await ensureCache(state);
    const results = await semanticSearchWithCache(query, cache, { k, model });
    send(res, 200, { query, results });
  } catch (err: any) {
    send(res, 500, { error: err?.message || String(err) });
  }
}

async function handleReload(state: ServerState, res: http.ServerResponse) {
  const index = await state.indexer.indexProject();
  state.indexer.saveIndex(index);
  state.cache = await buildDocCache(index, state.projectRoot);
  writeCache(state.projectRoot, state.cache);
  send(res, 200, { status: 'reloaded', files: Object.keys(index.files).length, vectors: state.cache.entries.length });
}

function start() {
  const config = createConfig(process.cwd());
  const indexer = new ProjectIndexer(config);
  const state: ServerState = { indexer, cache: null, projectRoot: config.projectRoot };

  const server = http.createServer(async (req, res) => {
    const { method, url } = req;
    if (!url) return send(res, 404, { error: 'no url' });

    if (url === '/health') return send(res, 200, { ok: true });

    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const bodyStr = chunks.length ? Buffer.concat(chunks).toString() : '{}';
      let body: any = {};
      try {
        body = JSON.parse(bodyStr);
      } catch {
        // ignore
      }

      const start = TRACE ? performance.now() : 0;

      if (url === '/search' && method === 'POST') {
        await handleSearch(state, req, res, body);
      } else if (url === '/semsearch' && method === 'POST') {
        await handleSemSearch(state, req, res, body);
      } else if (url === '/reload' && method === 'POST') {
        await handleReload(state, res);
      } else {
        send(res, 404, { error: 'not found' });
      }

      if (TRACE) {
        const dur = performance.now() - start;
        console.error(`[trace] ${method} ${url} ${dur.toFixed(1)}ms`);
      }

    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`project-index server listening on http://${HOST}:${PORT}`);
  });
}

start();
