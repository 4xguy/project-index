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
}

const DEFAULT_K = 20;

function loadIndex(projectRoot: string): ProjectIndex {
  const indexPath = path.join(projectRoot, '.context', '.project', 'PROJECT_INDEX.json');
  const raw = fs.readFileSync(indexPath, 'utf8');
  return JSON.parse(raw) as ProjectIndex;
}

function toText(symbol: string, location: string): string {
  return `${symbol} ${location}`;
}

export async function semanticSearch(
  query: string,
  opts: SemSearchOptions = {}
): Promise<SemSearchResult[]> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const index = loadIndex(projectRoot);
  const entries = Object.entries(index.symbolIndex || {});
  if (!entries.length) return [];

  const model = opts.model;
  const embedder = Embedder.get(model);

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
