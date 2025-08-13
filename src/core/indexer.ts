import { createHash } from 'crypto';
import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import fg from 'fast-glob';
import { TypeScriptParser } from '../parsers/typescript';
import { 
  ProjectIndex, 
  FileInfo, 
  IndexerConfig, 
  DependencyInfo,
  SymbolInfo
} from '../types';

export class ProjectIndexer {
  private config: IndexerConfig;
  private parsers: Map<string, any> = new Map();

  constructor(config: IndexerConfig) {
    this.config = config;
    this.initializeParsers();
  }

  private initializeParsers() {
    // Register TypeScript/JavaScript parser
    const tsParser = new TypeScriptParser();
    this.parsers.set('typescript', tsParser);
    this.parsers.set('javascript', tsParser);
    this.parsers.set('tsx', tsParser);
    this.parsers.set('jsx', tsParser);
  }

  /**
   * Perform full project indexing
   */
  async indexProject(): Promise<ProjectIndex> {
    console.log('🔍 Starting full project indexing...');
    
    const files = await this.discoverFiles();
    const existingIndex = this.loadIndex();
    
    console.log('🔍 Existing index found:', !!existingIndex);
    if (existingIndex) {
      console.log('📅 Preserving createdAt:', existingIndex.createdAt);
    }
    
    const index: ProjectIndex = {
      schemaVersion: '1.0.0',
      projectRoot: this.config.projectRoot,
      createdAt: existingIndex?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files: {},
      symbolIndex: {},
      dependencyGraph: {}
    };

    let processed = 0;
    for (const filePath of files) {
      try {
        const fileInfo = await this.indexFile(filePath);
        if (fileInfo) {
          index.files[filePath] = fileInfo;
          this.updateSymbolIndex(index.symbolIndex, fileInfo);
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`📁 Processed ${processed}/${files.length} files`);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to index ${filePath}:`, error);
      }
    }

    // Build dependency graph
    this.buildDependencyGraph(index);

    console.log(`✅ Indexing complete: ${processed} files processed`);
    return index;
  }

  /**
   * Index a single file
   */
  async indexFile(relativePath: string): Promise<FileInfo | null> {
    const fullPath = join(this.config.projectRoot, relativePath);
    
    if (!existsSync(fullPath)) {
      return null;
    }

    const stats = statSync(fullPath);
    if (stats.size > this.config.maxFileSize) {
      console.warn(`⚠️  Skipping ${relativePath}: file too large (${stats.size} bytes)`);
      return null;
    }

    const content = readFileSync(fullPath, 'utf-8');
    const hash = this.calculateHash(content);
    const language = this.detectLanguage(relativePath);
    const parser = this.parsers.get(language);

    if (!parser) {
      // Return basic file info without symbols
      return {
        path: relativePath,
        language,
        size: stats.size,
        hash,
        lastIndexedAt: new Date().toISOString(),
        imports: [],
        exports: [],
        symbols: [],
        outline: []
      };
    }

    try {
      const parseResult = await parser.parse(content, relativePath);
      
      return {
        path: relativePath,
        language,
        size: stats.size,
        hash,
        lastIndexedAt: new Date().toISOString(),
        imports: parseResult.imports,
        exports: parseResult.exports,
        symbols: parseResult.symbols,
        outline: parseResult.outline
      };
    } catch (error) {
      console.warn(`⚠️  Parse error in ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Discover all indexable files in the project
   */
  private async discoverFiles(): Promise<string[]> {
    const patterns = this.config.includePatterns.length > 0 
      ? this.config.includePatterns 
      : ['**/*.{ts,tsx,js,jsx,py,go,java,cs,rs}'];

    const files = await fg.async(patterns, {
      cwd: this.config.projectRoot,
      ignore: this.config.excludePatterns,
      onlyFiles: true,
      dot: false
    });

    return files.sort();
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript', 
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'java': 'java',
      'cs': 'csharp',
      'rs': 'rust'
    };

    return languageMap[ext || ''] || 'unknown';
  }

  /**
   * Calculate file content hash for change detection
   */
  private calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Update the symbol index with symbols from a file
   */
  private updateSymbolIndex(symbolIndex: Record<string, string>, fileInfo: FileInfo) {
    const updateSymbol = (symbol: SymbolInfo, parentPath = '') => {
      const symbolPath = parentPath ? `${parentPath}.${symbol.name}` : symbol.name;
      symbolIndex[symbolPath] = `${fileInfo.path}:${symbol.line}`;
      
      if (symbol.children) {
        symbol.children.forEach(child => updateSymbol(child, symbolPath));
      }
    };

    fileInfo.symbols.forEach(symbol => updateSymbol(symbol));
  }

  /**
   * Build dependency graph from imports/exports
   */
  private buildDependencyGraph(index: ProjectIndex) {
    // Initialize dependency graph
    Object.keys(index.files).forEach(filePath => {
      index.dependencyGraph[filePath] = {
        imports: [],
        importedBy: []
      };
    });

    // Build relationships
    Object.entries(index.files).forEach(([filePath, fileInfo]) => {
      const deps = index.dependencyGraph[filePath];
      
      fileInfo.imports.forEach(importInfo => {
        // Try to resolve relative imports to actual files
        const resolvedPath = this.resolveImport(importInfo.module, filePath);
        if (resolvedPath && index.files[resolvedPath]) {
          deps.imports.push(resolvedPath);
          index.dependencyGraph[resolvedPath].importedBy.push(filePath);
        } else {
          // External module
          deps.imports.push(importInfo.module);
        }
      });
    });
  }

  /**
   * Resolve relative imports to actual file paths
   */
  private resolveImport(module: string, fromFile: string): string | null {
    if (!module.startsWith('.')) {
      return null; // External module
    }

    const fromDir = join(this.config.projectRoot, fromFile, '..');
    const candidates = [
      `${module}.ts`,
      `${module}.tsx`, 
      `${module}.js`,
      `${module}.jsx`,
      `${module}/index.ts`,
      `${module}/index.tsx`,
      `${module}/index.js`,
      `${module}/index.jsx`
    ];

    for (const candidate of candidates) {
      const fullPath = resolve(fromDir, candidate);
      const relativePath = relative(this.config.projectRoot, fullPath);
      
      if (existsSync(fullPath)) {
        return relativePath.replace(/\\/g, '/'); // Normalize path separators
      }
    }

    return null;
  }

  /**
   * Save index to file
   */
  saveIndex(index: ProjectIndex) {
    const indexPath = join(this.config.projectRoot, this.config.indexFile);
    
    // Create directory if it doesn't exist
    const indexDir = dirname(indexPath);
    if (!existsSync(indexDir)) {
      mkdirSync(indexDir, { recursive: true });
      console.log(`📁 Created directory: ${relative(this.config.projectRoot, indexDir)}`);
    }
    
    const json = JSON.stringify(index, null, 2);
    writeFileSync(indexPath, json, 'utf-8');
    console.log(`💾 Index saved to ${this.config.indexFile}`);
  }

  /**
   * Load existing index from file
   */
  loadIndex(): ProjectIndex | null {
    const indexPath = join(this.config.projectRoot, this.config.indexFile);
    
    if (!existsSync(indexPath)) {
      return null;
    }

    try {
      const content = readFileSync(indexPath, 'utf-8');
      return JSON.parse(content) as ProjectIndex;
    } catch (error) {
      console.warn('⚠️  Failed to load existing index:', error);
      return null;
    }
  }

  /**
   * Check if file needs reindexing based on hash
   */
  needsReindexing(filePath: string, currentHash: string, index: ProjectIndex): boolean {
    const fileInfo = index.files[filePath];
    return !fileInfo || fileInfo.hash !== currentHash;
  }

  /**
   * Update index incrementally for changed files
   */
  async updateIndex(changedFiles: string[]): Promise<ProjectIndex> {
    const index = this.loadIndex() || await this.indexProject();
    
    let updated = 0;
    for (const filePath of changedFiles) {
      try {
        const fileInfo = await this.indexFile(filePath);
        if (fileInfo) {
          index.files[filePath] = fileInfo;
          updated++;
        }
      } catch (error) {
        console.warn(`⚠️  Failed to update ${filePath}:`, error);
      }
    }

    if (updated > 0) {
      // Rebuild symbol index and dependency graph
      index.symbolIndex = {};
      Object.values(index.files).forEach(fileInfo => {
        this.updateSymbolIndex(index.symbolIndex, fileInfo);
      });
      
      this.buildDependencyGraph(index);
      index.updatedAt = new Date().toISOString();
      
      console.log(`🔄 Updated ${updated} files in index`);
    }

    return index;
  }
}