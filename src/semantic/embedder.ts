import { pipeline, env } from '@xenova/transformers';

type EmbeddingPipeline = (input: string | string[]) => Promise<{ data: number[] | number[][] }>;

export interface EmbedderOptions {
  model?: string;
}

/**
 * Lazy-loaded singleton around @xenova/transformers embedding pipeline.
 * Defaults to intfloat/e5-small-v2 (384-d, lightweight).
 */
export class Embedder {
  private static instance: Embedder;
  private pipe?: EmbeddingPipeline;
  private model: string;

  private constructor(model?: string) {
    this.model = model ?? 'intfloat/e5-small-v2';
    // Disable telemetry/cache downloads to ~/.cache if not writable.
    env.allowRemoteModels = true;
    env.useBrowserCache = false;
  }

  static get(model?: string): Embedder {
    if (!Embedder.instance) {
      Embedder.instance = new Embedder(model);
    } else if (model && Embedder.instance.model !== model) {
      Embedder.instance = new Embedder(model);
    }
    return Embedder.instance;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.pipe) {
      const p = (await pipeline('feature-extraction', this.model)) as unknown as EmbeddingPipeline;
      this.pipe = p;
    }
    const result = await this.pipe(texts);
    const rows = Array.isArray(result.data[0]) ? (result.data as number[][]) : [result.data as number[]];
    return rows.map((row) => new Float32Array(row));
  }
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
