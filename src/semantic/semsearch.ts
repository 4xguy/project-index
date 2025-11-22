import fs from 'fs';
import path from 'path';
import { Embedder, cosine } from './embedder';

interface ProjectIndexSymbolMap {
  [symbol: string]: string; // file:line
}

interface ProjectIndex {
  symbolIndex: ProjectIndexSymbolMap;
}

export interface SemSearchResult {
  id: string;
  file: string;
  line?: number;
  score: number;
  type: 'symbol';
}

export interface SemSearchOptions {
  projectRoot?: string;
  k?: number;
  model?: string;
  profile?: 'fast' | 'quality';
}

const DEFAULT_K = 20;

export interface DocEntry {
  id: string;
  file: string;
  line?: number;
  text: string;
}

export interface DocCache {
  entries: DocEntry[];
  vectors: Float32Array[];
  model: string;
}

const INDEX_FILE = path.join('.context', '.project', 'PROJECT_INDEX.json');
const VECTORS_FILE = path.join('.context', '.project', 'PROJECT_INDEX.vectors.jsonl');

function loadIndex(projectRoot: string): ProjectIndex {
  const indexPath = path.join(projectRoot, INDEX_FILE);
  const raw = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(raw) as ProjectIndex;
}

function toText(symbol: string, location: string): string {
  return `${symbol} ${location}`;
}

function vectorsPath(projectRoot: string) {
  return path.join(projectRoot, VECTORS_FILE);
}

export function writeCache(projectRoot: string, cache: DocCache) {
  const header = { model: cache.model, count: cache.entries.length };
  const lines = [JSON.stringify(header)];
  cache.entries.forEach((entry, i) => {
    const vec = Array.from(cache.vectors[i]);
    lines.push(JSON.stringify({ ...entry, vec }));
  });
  fs.mkdirSync(path.dirname(vectorsPath(projectRoot)), { recursive: true });
  fs.writeFileSync(vectorsPath(projectRoot), lines.join('\n'), 'utf8');
}

export function readCache(projectRoot: string): DocCache | null {
  const file = vectorsPath(projectRoot);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  if (!lines.length) return null;
  const header = JSON.parse(lines[0]);
  const entries: DocEntry[] = [];
  const vectors: Float32Array[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = JSON.parse(lines[i]);
    const { vec, ...rest } = row;
    entries.push(rest as DocEntry);
    vectors.push(new Float32Array(vec));
  }
  return { entries, vectors, model: header.model || 'unknown' };
}

export async function buildDocCache(
  index: ProjectIndex,
  projectRoot: string,
  model?: string,
  profile?: 'fast' | 'quality',
  reuse?: DocCache
): Promise<DocCache> {
  const embedder = Embedder.get(model, profile);
  const entries: DocEntry[] = Object.entries(index.symbolIndex || {}).map(([sym, loc]) => {
    const [file, lineStr] = loc.split(':');
    const line = Number(lineStr);
    return {
      id: `${file}:${sym}`,
      file,
      line: Number.isFinite(line) ? line : undefined,
      text: toText(sym, loc),
    };
  });

  const vectors: Float32Array[] = [];
  const texts = entries.map((e) => e.text);

  // Simple reuse: if sizes match and model matches, reuse existing vectors.
  if (reuse && reuse.model === embedder.modelName && reuse.entries.length === entries.length) {
    return reuse;
  }

  const embedded = await embedder.embed(texts);
  for (const v of embedded) vectors.push(v);

  return { entries, vectors, model: embedder.modelName };
}

export async function semanticSearch(
  query: string,
  opts: SemSearchOptions = {}
): Promise<SemSearchResult[]> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const index = loadIndex(projectRoot);
  const entries = Object.entries(index.symbolIndex || {});
  if (!entries.length) return [];

  const embedder = Embedder.get(opts.model, opts.profile);

  const docs = entries.map(([sym, loc]) => toText(sym, loc));
  const [queryVec, ...docVecs] = await embedder.embed([query, ...docs]);

  const results: SemSearchResult[] = entries.map(([sym, loc], i) => {
    const [file, lineStr] = loc.split(':');
    const line = Number(lineStr);
    return {
      id: `${file}:${sym}`,
      file,
      line: Number.isFinite(line) ? line : undefined,
      score: cosine(queryVec, docVecs[i]),
      type: 'symbol',
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, opts.k ?? DEFAULT_K);
}

export async function semanticSearchWithCache(
  query: string,
  cache: DocCache,
  opts: { k?: number; model?: string; profile?: 'fast' | 'quality' } = {}
): Promise<SemSearchResult[]> {
  const embedder = Embedder.get(opts.model || cache.model, opts.profile);
  const [queryVec] = await embedder.embed([query]);
  const results: SemSearchResult[] = cache.entries.map((entry, i) => ({
    id: entry.id,
    file: entry.file,
    line: entry.line,
    score: cosine(queryVec, cache.vectors[i]),
    type: 'symbol',
  }));
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, opts.k ?? DEFAULT_K);
}
