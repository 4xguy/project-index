import { watch, FSWatcher } from 'chokidar';
import { ProjectIndexer } from './indexer';
import { IndexerConfig } from '../types';
import { debounce } from '../utils/debounce';

export class IndexWatcher {
  private watcher: FSWatcher | null = null;
  private indexer: ProjectIndexer;
  private config: IndexerConfig;
  private debouncedUpdate: (files: string[]) => void;
  private pendingFiles = new Set<string>();
  private isRunning = false;

  constructor(indexer: ProjectIndexer, config: IndexerConfig) {
    this.indexer = indexer;
    this.config = config;
    
    // Debounce updates to batch changes within 1 second
    this.debouncedUpdate = debounce(this.processPendingUpdates.bind(this), 1000);
  }

  /**
   * Start watching for file changes
   */
  start(): void {
    if (this.isRunning) {
      console.log('👀 Watcher already running');
      return;
    }

    console.log('🚀 Starting file watcher...');

    const watchPatterns = [
      '**/*.{ts,tsx,js,jsx,py,go,java,cs,rs}',
      '!node_modules/**',
      '!.git/**',
      '!dist/**',
      '!build/**',
      '!coverage/**'
    ];

    this.watcher = watch(watchPatterns, {
      cwd: this.config.projectRoot,
      ignored: this.config.excludePatterns,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher
      .on('add', (path) => {
        console.log(`📁 File added: ${path}`);
        this.queueUpdate(path);
      })
      .on('change', (path) => {
        console.log(`📝 File changed: ${path}`);
        this.queueUpdate(path);
      })
      .on('unlink', (path) => {
        console.log(`🗑️  File deleted: ${path}`);
        this.queueDelete(path);
      })
      .on('error', (error) => {
        console.error('❌ Watcher error:', error);
      })
      .on('ready', () => {
        this.isRunning = true;
        console.log('👀 File watcher ready');
      });

    // Handle process signals for graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * Stop watching for file changes
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.watcher) {
      return;
    }

    console.log('🛑 Stopping file watcher...');
    
    // Process any pending updates before stopping
    if (this.pendingFiles.size > 0) {
      await this.processPendingUpdates();
    }

    await this.watcher.close();
    this.watcher = null;
    this.isRunning = false;
    
    console.log('✅ File watcher stopped');
  }

  /**
   * Queue a file for updating
   */
  private queueUpdate(filePath: string): void {
    this.pendingFiles.add(filePath);
    this.debouncedUpdate([]);
  }

  /**
   * Queue a file for deletion from index
   */
  private queueDelete(filePath: string): void {
    // Remove from pending updates if queued
    this.pendingFiles.delete(filePath);
    
    // Immediately remove from index
    this.removeFromIndex(filePath);
  }

  /**
   * Process all pending file updates
   */
  private async processPendingUpdates(): Promise<void> {
    if (this.pendingFiles.size === 0) {
      return;
    }

    const filesToUpdate = Array.from(this.pendingFiles);
    this.pendingFiles.clear();

    console.log(`🔄 Processing ${filesToUpdate.length} file updates...`);

    try {
      const startTime = Date.now();
      const updatedIndex = await this.indexer.updateIndex(filesToUpdate);
      this.indexer.saveIndex(updatedIndex);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Index updated in ${duration}ms`);
    } catch (error) {
      console.error('❌ Failed to update index:', error);
      
      // Re-queue failed files for retry
      filesToUpdate.forEach(file => this.pendingFiles.add(file));
    }
  }

  /**
   * Remove a file from the index
   */
  private removeFromIndex(filePath: string): void {
    try {
      const index = this.indexer.loadIndex();
      if (!index) {
        return;
      }

      if (index.files[filePath]) {
        // Remove file from index
        delete index.files[filePath];
        
        // Remove from dependency graph
        if (index.dependencyGraph[filePath]) {
          // Remove references to this file from other files
          const deps = index.dependencyGraph[filePath];
          deps.importedBy.forEach(importingFile => {
            if (index.dependencyGraph[importingFile]) {
              const importsList = index.dependencyGraph[importingFile].imports;
              const importIndex = importsList.indexOf(filePath);
              if (importIndex > -1) {
                importsList.splice(importIndex, 1);
              }
            }
          });
          
          delete index.dependencyGraph[filePath];
        }

        // Rebuild symbol index (simple approach - could be optimized)
        index.symbolIndex = {};
        Object.values(index.files).forEach(fileInfo => {
          this.indexer['updateSymbolIndex'](index.symbolIndex, fileInfo);
        });

        index.updatedAt = new Date().toISOString();
        this.indexer.saveIndex(index);
        
        console.log(`🗑️  Removed ${filePath} from index`);
      }
    } catch (error) {
      console.error(`❌ Failed to remove ${filePath} from index:`, error);
    }
  }

  /**
   * Get watcher status
   */
  getStatus(): { isRunning: boolean; watchedFiles?: number; pendingUpdates: number } {
    return {
      isRunning: this.isRunning,
      watchedFiles: this.watcher?.getWatched() ? Object.keys(this.watcher.getWatched()).length : undefined,
      pendingUpdates: this.pendingFiles.size
    };
  }

  /**
   * Force process all pending updates immediately
   */
  async flushPendingUpdates(): Promise<void> {
    if (this.pendingFiles.size > 0) {
      console.log('⚡ Flushing pending updates...');
      await this.processPendingUpdates();
    }
  }
}