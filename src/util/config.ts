import { resolve } from 'path';
import { IndexerConfig } from '../types';

export function createConfig(projectPath: string): IndexerConfig {
  return {
    projectRoot: resolve(projectPath),
    indexFile: '.context/.project/PROJECT_INDEX.json',
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '.next/**',
      '.cache/**',
      'out/**'
    ],
    includePatterns: ['**/*.{ts,tsx,js,jsx,py,go,java,cs,rs}'],
    maxFileSize: 1024 * 1024, // 1MB
    languages: ['typescript', 'javascript', 'python', 'go', 'java', 'csharp', 'rust']
  };
}
