import { pipeline, env } from '@xenova/transformers';
import { pickModel, SemanticProfile, detectGPU } from './models';

type EmbeddingPipeline = (input: string | string[]) => Promise<{ data: number[] | number[][] }>;

export interface EmbedderOptions {
  model?: string;
  profile?: SemanticProfile;
}

/**
 * Lazy-loaded singleton around @xenova/transformers embedding pipeline.
 * Defaults to intfloat/e5-small-v2 (384-d, lightweight).
 */
export class Embedder {
  private static instance: Embedder;
  private pipe?: EmbeddingPipeline;
  private model: string;
  get modelName() {
    return this.model;
  }

  private constructor(model?: string, profile?: SemanticProfile) {
    // Pick model based on profile and GPU detection unless explicitly provided.
    if (model) {
      this.model = model;
    } else {
      const gpu = detectGPU();
      const prof = profile ?? 'fast';
      const spec = pickModel(prof, gpu);
      this.model = spec.name;
    }
    // Disable telemetry/cache downloads to ~/.cache if not writable.
    env.allowRemoteModels = true;
    env.useBrowserCache = false;
  }

  static get(model?: string, profile?: SemanticProfile): Embedder {
    if (!Embedder.instance) {
      Embedder.instance = new Embedder(model, profile);
    } else if (model && Embedder.instance.model !== model) {
      Embedder.instance = new Embedder(model, profile);
    }
    return Embedder.instance;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.pipe) {
      const p = (await pipeline('feature-extraction', this.model, {
        pooling: 'mean',
        normalize: true,
      } as any)) as unknown as EmbeddingPipeline;
      this.pipe = p;
    }
    const result = await this.pipe(texts);
    if (!Array.isArray(result.data) && (result as any).dims) {
      const data = result.data as Float32Array;
      const dims = (result as any).dims as number[];
      // Handle [batch, seq, dim] by mean pooling over seq.
      if (dims.length === 3) {
        const [batch, seq, dim] = dims;
        const out: Float32Array[] = [];
        for (let b = 0; b < batch; b++) {
          const start = b * seq * dim;
          const vec = new Float32Array(dim);
          for (let s = 0; s < seq; s++) {
            const offset = start + s * dim;
            for (let d = 0; d < dim; d++) {
              vec[d] += data[offset + d];
            }
          }
          for (let d = 0; d < dim; d++) vec[d] /= seq;
          out.push(vec);
        }
        return out;
      }
      if (dims.length === 2) {
        const [batch, dim] = dims;
        const out: Float32Array[] = [];
        for (let b = 0; b < batch; b++) {
          const start = b * dim;
          out.push(data.slice(start, start + dim));
        }
        return out;
      }
    }
    // Fallback: assume nested arrays
    const rows = Array.isArray(result.data[0]) ? (result.data as number[][]) : [result.data as number[]];
    return rows.map((row) => new Float32Array(row as number[]));
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
