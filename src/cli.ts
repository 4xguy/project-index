#!/usr/bin/env node

import { Command } from 'commander';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { ProjectIndexer } from './core/indexer';
import { IndexWatcher } from './core/watcher';
import { IndexerConfig } from './types';

const program = new Command();

// Default configuration
function createConfig(projectPath: string): IndexerConfig {
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

program
  .name('project-index')
  .description('Token-free project indexer for Claude Code')
  .version('1.0.0');

program
  .command('index')
  .description('Perform full project indexing')
  .argument('[path]', 'Project path', '.')
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath: string, options) => {
    console.log('🔍 Project Indexer v1.0.0');
    
    const config = createConfig(projectPath);
    
    if (!existsSync(config.projectRoot)) {
      console.error(`❌ Project path does not exist: ${config.projectRoot}`);
      process.exit(1);
    }

    console.log(`📁 Indexing project: ${config.projectRoot}`);
    
    try {
      const indexer = new ProjectIndexer(config);
      const index = await indexer.indexProject();
      indexer.saveIndex(index);
      
      console.log('\n📊 Index Statistics:');
      console.log(`   Files indexed: ${Object.keys(index.files).length}`);
      console.log(`   Symbols found: ${Object.keys(index.symbolIndex).length}`);
      console.log(`   Dependencies: ${Object.keys(index.dependencyGraph).length}`);
      console.log(`   Generated: ${index.createdAt}`);
      console.log(`\n💾 Index saved to: ${join(config.projectRoot, config.indexFile)}`);
      
    } catch (error) {
      console.error('❌ Indexing failed:', error);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Start file watcher for incremental updates')
  .argument('[path]', 'Project path', '.')
  .option('-d, --daemon', 'Run as daemon')
  .action(async (projectPath: string, options) => {
    const config = createConfig(projectPath);
    
    if (!existsSync(config.projectRoot)) {
      console.error(`❌ Project path does not exist: ${config.projectRoot}`);
      process.exit(1);
    }

    console.log(`👀 Starting watcher for: ${config.projectRoot}`);
    
    // Ensure index exists
    const indexPath = join(config.projectRoot, config.indexFile);
    if (!existsSync(indexPath)) {
      console.log('📋 No existing index found, creating initial index...');
      const indexer = new ProjectIndexer(config);
      const index = await indexer.indexProject();
      indexer.saveIndex(index);
      console.log('✅ Initial index created');
    }

    try {
      const indexer = new ProjectIndexer(config);
      const watcher = new IndexWatcher(indexer, config);
      
      watcher.start();
      
      // Keep process alive
      if (options.daemon) {
        console.log('🔄 Running in daemon mode (Ctrl+C to stop)');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n🛑 Received SIGINT, shutting down gracefully...');
          await watcher.stop();
          process.exit(0);
        });
        
        // Keep the process running
        setInterval(() => {
          const status = watcher.getStatus();
          if (status.pendingUpdates > 0) {
            console.log(`⏳ Pending updates: ${status.pendingUpdates}`);
          }
        }, 30000); // Log status every 30 seconds
        
      } else {
        console.log('Press Ctrl+C to stop watching');
        process.stdin.resume();
      }
      
    } catch (error) {
      console.error('❌ Watcher failed:', error);
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update specific files in the index')
  .argument('[path]', 'Project path', '.')
  .argument('[files...]', 'Files to update')
  .action(async (projectPath: string, files: string[]) => {
    if (files.length === 0) {
      console.log('📝 No files specified for update');
      return;
    }

    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    
    try {
      console.log(`🔄 Updating ${files.length} files...`);
      const index = await indexer.updateIndex(files);
      indexer.saveIndex(index);
      console.log('✅ Update complete');
    } catch (error) {
      console.error('❌ Update failed:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show index status and statistics')
  .argument('[path]', 'Project path', '.')
  .action((projectPath: string) => {
    const config = createConfig(projectPath);
    const indexPath = join(config.projectRoot, config.indexFile);
    
    if (!existsSync(indexPath)) {
      console.log('❌ No index file found. Run "project-index index" first.');
      return;
    }

    try {
      const indexer = new ProjectIndexer(config);
      const index = indexer.loadIndex();
      
      if (!index) {
        console.log('❌ Failed to load index file');
        return;
      }

      console.log('📊 Project Index Status\n');
      console.log(`📁 Project Root: ${index.projectRoot}`);
      console.log(`📋 Schema Version: ${index.schemaVersion}`);
      console.log(`🕒 Created: ${index.createdAt}`);
      console.log(`🔄 Last Updated: ${index.updatedAt}`);
      console.log(`\n📈 Statistics:`);
      console.log(`   Files indexed: ${Object.keys(index.files).length}`);
      console.log(`   Total symbols: ${Object.keys(index.symbolIndex).length}`);
      console.log(`   Dependencies: ${Object.keys(index.dependencyGraph).length}`);
      
      // Language breakdown
      const languageCounts: Record<string, number> = {};
      Object.values(index.files).forEach(file => {
        languageCounts[file.language] = (languageCounts[file.language] || 0) + 1;
      });
      
      console.log(`\n🌐 Languages:`);
      Object.entries(languageCounts).forEach(([lang, count]) => {
        console.log(`   ${lang}: ${count} files`);
      });
      
    } catch (error) {
      console.error('❌ Failed to read index:', error);
    }
  });

program
  .command('search')
  .description('Search for symbols in the index')
  .argument('<query>', 'Symbol name or pattern')
  .argument('[path]', 'Project path', '.')
  .option('-e, --exact', 'Exact match only')
  .action((query: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      console.log('❌ No index file found. Run "project-index index" first.');
      return;
    }

    console.log(`🔍 Searching for: "${query}"\n`);
    
    const results = Object.entries(index.symbolIndex).filter(([symbol, location]) => {
      return options.exact 
        ? symbol === query
        : symbol.toLowerCase().includes(query.toLowerCase());
    });

    if (results.length === 0) {
      console.log('❌ No symbols found');
      return;
    }

    console.log(`✅ Found ${results.length} symbols:\n`);
    results.forEach(([symbol, location]) => {
      console.log(`   ${symbol} → ${location}`);
    });
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(`❌ ${str}`),
});

program.parse();