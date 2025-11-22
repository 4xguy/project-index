export type SemanticProfile = 'fast' | 'quality';

export interface ModelSpec {
  name: string;
  dims: number;
  pooling?: 'mean' | 'cls';
}

// Registry of candidate models by profile.
const MODEL_REGISTRY: Record<SemanticProfile, ModelSpec[]> = {
  fast: [
    { name: 'Xenova/all-MiniLM-L6-v2', dims: 384, pooling: 'mean' },
  ],
  quality: [
    // CPU-friendly but higher quality than MiniLM.
    { name: 'Xenova/bge-m3', dims: 1024, pooling: 'mean' },
    // GPU-capable mid-size option; may still run on CPU but slower.
    { name: 'Xenova/Qwen3-Embedding-0.6B', dims: 1024, pooling: 'mean' },
  ],
};

export function detectGPU(): boolean {
  // Heuristic: check for NVIDIA via nvidia-smi availability.
  // In environments without nvidia-smi, return false.
  try {
    const { execSync } = require('child_process');
    execSync('nvidia-smi -L', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function pickModel(profile: SemanticProfile, gpuDetected: boolean): ModelSpec {
  // If GPU present and profile is quality, try higher-quality entries first (Qwen), otherwise bge-m3.
  const list = MODEL_REGISTRY[profile];
  if (profile === 'quality' && gpuDetected) {
    return list[1] ?? list[0];
  }
  return list[0];
}
