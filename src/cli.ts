#!/usr/bin/env node

import { Command } from 'commander';
import { join } from 'path';
import { existsSync } from 'fs';
import { ProjectIndexer } from './core/indexer';
import { IndexWatcher } from './core/watcher';
import { SymbolKind } from './types';
import { createConfig } from './util/config';

const program = new Command();
const DEFAULT_SERVER = process.env.PROJECT_INDEX_SERVER || 'http://127.0.0.1:4545';
const TRACE = !!process.env.PROJECT_INDEX_TRACE;

async function callServer(path: string, body: any) {
  const fetchFn = (globalThis as any).fetch;
  if (!fetchFn) return null;
  const url = `${DEFAULT_SERVER}${path}`;
  const t0 = TRACE ? performance.now() : 0;
  try {
    const resp = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (TRACE) {
      console.error(`[trace] server ${path} ${resp.status} ${(performance.now() - t0).toFixed(1)}ms`);
    }
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

program
  .name('project-index')
  .description('Agent-optimized project indexer for Claude Code with smart context analysis')
  .version('1.2.0');

program
  .command('index')
  .description('Perform full project indexing')
  .argument('[path]', 'Project path', '.')
  .option('-v, --verbose', 'Verbose output')
  .action(async (projectPath: string, options) => {
    console.log('🔍 Project Indexer v1.2.0 (Agent-Optimized)');
    
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
  .option('--json', 'Output as JSON for agent consumption')
  .action(async (query: string, projectPath: string, options) => {
    // Try server first
    const serverResp = await callServer('/search', { query, exact: options.exact });
    if (serverResp) {
      if (options.json) {
        console.log(JSON.stringify({ query, results: serverResp.results }, null, 2));
      } else {
        const results = serverResp.results || [];
        console.log(`🔍 Searching for: "${query}"\n`);
        if (!results.length) return console.log('❌ No symbols found');
        console.log(`✅ Found ${results.length} symbols:\n`);
        results.forEach((item: any) => console.log(`   ${item.symbol} → ${item.location}`));
      }
      return;
    }

    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }
    
    const results = Object.entries(index.symbolIndex).filter(([symbol, location]) => {
      return options.exact 
        ? symbol === query
        : symbol.toLowerCase().includes(query.toLowerCase());
    });

    if (options.json) {
      const jsonResult = {
        query,
        exact: options.exact || false,
        results: results.map(([symbol, location]) => ({ symbol, location })),
        count: results.length
      };
      console.log(JSON.stringify(jsonResult, null, 2));
    } else {
      console.log(`🔍 Searching for: "${query}"\n`);
      
      if (results.length === 0) {
        console.log('❌ No symbols found');
        return;
      }

      console.log(`✅ Found ${results.length} symbols:\n`);
      results.forEach(([symbol, location]) => {
        console.log(`   ${symbol} → ${location}`);
      });
    }
  });

program
  .command('semsearch')
  .description('Semantic search for symbols (embeddings, opt-in)')
  .argument('<query>', 'Free-text query')
  .argument('[path]', 'Project path', '.')
  .option('-k, --k <number>', 'number of results', (v) => parseInt(v, 10))
  .option('--model <name>', 'embedding model (default intfloat/e5-small-v2)')
  .option('--profile <profile>', 'semantic profile: fast|quality')
  .option('--json', 'Output as JSON')
  .action(async (query: string, projectPath: string, options) => {
    const serverResp = await callServer('/semsearch', {
      query,
      k: options.k,
      model: options.model,
      profile: options.profile,
    });
    if (serverResp) {
      const results = serverResp.results || [];
      if (options.json) {
        console.log(JSON.stringify({ query, results }, null, 2));
      } else {
        if (!results.length) {
          console.log('❌ No results found.');
          return;
        }
        console.log(`🔍 Semantic matches for "${query}"\n`);
        results.forEach((r: any, idx: number) => {
          const line = r.line ? `:${r.line}` : '';
          console.log(`${idx + 1}. ${r.file}${line}  (score ${r.score.toFixed(3)})`);
          console.log(`   ${r.id}`);
        });
      }
      return;
    }

    const config = createConfig(projectPath);
    const indexPath = join(config.projectRoot, config.indexFile);
    if (!existsSync(indexPath)) {
      const msg = 'No index file found. Run "project-index index" first.';
      if (options.json) {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error(`❌ ${msg}`);
      }
      return;
    }
    try {
      const { semanticSearch } = await import('./semantic/semsearch');
      const results = await semanticSearch(query, {
        projectRoot: config.projectRoot,
        k: options.k,
        model: options.model,
      });
      if (options.json) {
        console.log(JSON.stringify({ query, results }, null, 2));
      } else {
        if (!results.length) {
          console.log('❌ No results found.');
          return;
        }
        console.log(`🔍 Semantic matches for "${query}"\n`);
        results.forEach((r, idx) => {
          const line = r.line ? `:${r.line}` : '';
          console.log(`${idx + 1}. ${r.file}${line}  (score ${r.score.toFixed(3)})`);
          console.log(`   ${r.id}`);
        });
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (options.json) {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error('❌ Semantic search failed:', msg);
      }
      process.exit(1);
    }
  });

program
  .command('suggest')
  .description('Smart context suggestions for agents')
  .argument('<context>', 'Context query (e.g., "auth", "api", "components")')
  .argument('[path]', 'Project path', '.')
  .option('--json', 'Output as JSON for agent consumption')
  .action((context: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    const contextLower = context.toLowerCase();
    const allSymbols = Object.entries(index.symbolIndex);
    
    // Score symbols based on relevance to context
    const scoredSymbols = allSymbols.map(([symbol, location]) => {
      let score = 0;
      const symbolLower = symbol.toLowerCase();
      
      // Direct match gets highest score
      if (symbolLower.includes(contextLower)) {
        score += 100;
      }
      
      // Partial matches
      const contextWords = contextLower.split(/[_\-\s]/);
      const symbolWords = symbolLower.split(/[_\-\s]/);
      
      contextWords.forEach(contextWord => {
        symbolWords.forEach(symbolWord => {
          if (symbolWord.includes(contextWord) || contextWord.includes(symbolWord)) {
            score += 50;
          }
        });
      });
      
      // Common patterns
      const patterns = {
        'auth': ['login', 'signin', 'auth', 'user', 'session', 'token'],
        'api': ['api', 'endpoint', 'route', 'service', 'client', 'request'],
        'component': ['component', 'button', 'form', 'modal', 'card', 'layout'],
        'state': ['state', 'store', 'reducer', 'context', 'provider'],
        'util': ['util', 'helper', 'tool', 'format', 'validate'],
        'test': ['test', 'spec', 'mock', 'fixture']
      };
      
      Object.entries(patterns).forEach(([pattern, keywords]) => {
        if (contextLower.includes(pattern)) {
          keywords.forEach(keyword => {
            if (symbolLower.includes(keyword)) {
              score += 25;
            }
          });
        }
      });
      
      return { symbol, location, score };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const primary = scoredSymbols.slice(0, 3);
    const related = scoredSymbols.slice(3, 8);
    
    if (options.json) {
      const result = {
        context,
        primary: primary.map(item => ({ symbol: item.symbol, location: item.location, confidence: Math.min(item.score / 100, 1) })),
        related: related.map(item => ({ symbol: item.symbol, location: item.location, confidence: Math.min(item.score / 100, 1) })),
        total_matches: scoredSymbols.length
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`🎯 Context suggestions for: "${context}"\n`);
      
      if (primary.length > 0) {
        console.log('🔥 Primary matches:');
        primary.forEach(item => {
          console.log(`   ${item.symbol} → ${item.location} (${Math.round(item.score)}%)`);
        });
      }
      
      if (related.length > 0) {
        console.log('\n🔗 Related symbols:');
        related.forEach(item => {
          console.log(`   ${item.symbol} → ${item.location} (${Math.round(item.score)}%)`);
        });
      }
      
      if (scoredSymbols.length === 0) {
        console.log('❌ No relevant symbols found');
      }
    }
  });

program
  .command('deps')
  .description('Show dependency relationships')
  .argument('<file>', 'File path to analyze')
  .argument('[path]', 'Project path', '.')
  .option('--reverse', 'Show what depends on this file')
  .option('--json', 'Output as JSON for agent consumption')
  .option('--orphans', 'Show files with no dependencies (only valid without file argument)')
  .action((file: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    if (options.orphans) {
      // Find files with no dependencies
      const orphans = Object.keys(index.files).filter(filePath => {
        const deps = index.dependencyGraph[filePath];
        return !deps || (deps.imports.length === 0 && deps.importedBy.length === 0);
      });
      
      if (options.json) {
        console.log(JSON.stringify({ orphans, count: orphans.length }));
      } else {
        console.log(`🗂️  Orphaned files (${orphans.length}):\n`);
        orphans.forEach(orphan => console.log(`   ${orphan}`));
      }
      return;
    }

    // Normalize file path
    const normalizedFile = file.startsWith('./') ? file.substring(2) : file;
    const deps = index.dependencyGraph[normalizedFile];
    
    if (!deps) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'File not found in dependency graph', file: normalizedFile }));
      } else {
        console.log(`❌ File not found in dependency graph: ${normalizedFile}`);
      }
      return;
    }

    if (options.reverse) {
      // Show what depends on this file
      if (options.json) {
        console.log(JSON.stringify({
          file: normalizedFile,
          importedBy: deps.importedBy,
          count: deps.importedBy.length
        }));
      } else {
        console.log(`📥 Files that import ${normalizedFile} (${deps.importedBy.length}):\n`);
        deps.importedBy.forEach(importer => console.log(`   ${importer}`));
      }
    } else {
      // Show what this file depends on
      if (options.json) {
        console.log(JSON.stringify({
          file: normalizedFile,
          imports: deps.imports,
          count: deps.imports.length
        }));
      } else {
        console.log(`📤 Dependencies of ${normalizedFile} (${deps.imports.length}):\n`);
        deps.imports.forEach(imported => console.log(`   ${imported}`));
      }
    }
  });

program
  .command('impact')
  .description('Analyze change impact for a file')
  .argument('<file>', 'File path to analyze impact for')
  .argument('[path]', 'Project path', '.')
  .option('--json', 'Output as JSON for agent consumption')
  .option('--depth <number>', 'Dependency depth to analyze', '2')
  .action((file: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    // Normalize file path
    const normalizedFile = file.startsWith('./') ? file.substring(2) : file;
    const deps = index.dependencyGraph[normalizedFile];
    
    if (!deps) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'File not found in dependency graph', file: normalizedFile }));
      } else {
        console.log(`❌ File not found in dependency graph: ${normalizedFile}`);
      }
      return;
    }

    const maxDepth = parseInt(options.depth) || 2;
    const analyzed = new Set<string>();
    
    // Calculate impact with confidence levels
    function calculateImpact(filePath: string, currentDepth: number): { high: string[], medium: string[], low: string[] } {
      if (currentDepth > maxDepth || analyzed.has(filePath) || !index) {
        return { high: [], medium: [], low: [] };
      }
      
      analyzed.add(filePath);
      const fileDeps = index.dependencyGraph[filePath];
      
      if (!fileDeps) {
        return { high: [], medium: [], low: [] };
      }
      
      let high: string[] = [];
      let medium: string[] = [];
      let low: string[] = [];
      
      // Direct dependencies are high confidence
      if (currentDepth === 1) {
        high = [...fileDeps.importedBy];
      } else if (currentDepth === 2) {
        medium = [...fileDeps.importedBy];
      } else {
        low = [...fileDeps.importedBy];
      }
      
      // Recursively analyze dependencies
      fileDeps.importedBy.forEach(importingFile => {
        const recursive = calculateImpact(importingFile, currentDepth + 1);
        high = [...high, ...recursive.high];
        medium = [...medium, ...recursive.medium];
        low = [...low, ...recursive.low];
      });
      
      return { high, medium, low };
    }

    const impact = calculateImpact(normalizedFile, 1);
    
    // Deduplicate and categorize
    const highImpact = [...new Set(impact.high)];
    const mediumImpact = [...new Set(impact.medium)].filter(f => !highImpact.includes(f));
    const lowImpact = [...new Set(impact.low)].filter(f => !highImpact.includes(f) && !mediumImpact.includes(f));
    
    // Find related test files
    const testFiles = Object.keys(index.files).filter(f => 
      (f.includes('.test.') || f.includes('.spec.') || f.includes('/test/')) &&
      (highImpact.includes(f) || mediumImpact.includes(f) || lowImpact.includes(f) || 
       f.includes(normalizedFile.replace(/\.[^/.]+$/, "").split('/').pop() || ''))
    );
    
    if (options.json) {
      console.log(JSON.stringify({
        file: normalizedFile,
        impact: {
          high: highImpact,
          medium: mediumImpact,
          low: lowImpact
        },
        tests: testFiles,
        totalAffected: highImpact.length + mediumImpact.length + lowImpact.length,
        analysisDepth: maxDepth
      }, null, 2));
    } else {
      console.log(`💥 Change impact analysis for: ${normalizedFile}\n`);
      
      if (highImpact.length > 0) {
        console.log(`🔴 High impact (${highImpact.length} files):`);
        highImpact.forEach(f => console.log(`   ${f}`));
        console.log();
      }
      
      if (mediumImpact.length > 0) {
        console.log(`🟡 Medium impact (${mediumImpact.length} files):`);
        mediumImpact.forEach(f => console.log(`   ${f}`));
        console.log();
      }
      
      if (lowImpact.length > 0) {
        console.log(`🟢 Low impact (${lowImpact.length} files):`);
        lowImpact.forEach(f => console.log(`   ${f}`));
        console.log();
      }
      
      if (testFiles.length > 0) {
        console.log(`🧪 Related test files (${testFiles.length}):`);
        testFiles.forEach(f => console.log(`   ${f}`));
        console.log();
      }
      
      const total = highImpact.length + mediumImpact.length + lowImpact.length;
      console.log(`📊 Total affected: ${total} files`);
    }
  });

program
  .command('calls')
  .description('Show functions that this symbol calls')
  .argument('<symbol>', 'Symbol name to analyze')
  .argument('[path]', 'Project path', '.')
  .option('--json', 'Output as JSON for agent consumption')
  .action((symbol: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    // Find the symbol in the index
    let foundSymbol: any = null;
    let foundFile: string = '';
    
    Object.entries(index.files).forEach(([filePath, fileInfo]) => {
      fileInfo.symbols.forEach(sym => {
        if (sym.name === symbol) {
          foundSymbol = sym;
          foundFile = filePath;
        }
        // Check nested symbols (methods in classes)
        if (sym.children) {
          sym.children.forEach(child => {
            if (child.name === symbol || `${sym.name}.${child.name}` === symbol) {
              foundSymbol = child;
              foundFile = filePath;
            }
          });
        }
      });
    });

    if (!foundSymbol) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'Symbol not found', symbol }));
      } else {
        console.log(`❌ Symbol '${symbol}' not found in index`);
      }
      return;
    }

    const calls = foundSymbol.calls || [];
    
    if (options.json) {
      console.log(JSON.stringify({
        symbol,
        file: foundFile,
        line: foundSymbol.line,
        calls,
        count: calls.length
      }, null, 2));
    } else {
      console.log(`📞 Functions called by '${symbol}' (${calls.length}):\n`);
      if (calls.length === 0) {
        console.log('   No function calls found');
      } else {
        calls.forEach((call: string) => console.log(`   ${call}`));
      }
    }
  });

program
  .command('called-by')
  .description('Show functions that call this symbol')
  .argument('<symbol>', 'Symbol name to analyze')
  .argument('[path]', 'Project path', '.')
  .option('--json', 'Output as JSON for agent consumption')
  .action((symbol: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    // Find all symbols that call the target symbol
    const callers: Array<{ symbol: string; file: string; line: number }> = [];
    
    Object.entries(index.files).forEach(([filePath, fileInfo]) => {
      fileInfo.symbols.forEach(sym => {
        if (sym.calls?.includes(symbol)) {
          callers.push({ symbol: sym.name, file: filePath, line: sym.line });
        }
        // Check nested symbols (methods in classes)
        if (sym.children) {
          sym.children.forEach(child => {
            if (child.calls?.includes(symbol)) {
              callers.push({ 
                symbol: `${sym.name}.${child.name}`, 
                file: filePath, 
                line: child.line 
              });
            }
          });
        }
      });
    });

    if (options.json) {
      console.log(JSON.stringify({
        symbol,
        callers,
        count: callers.length
      }, null, 2));
    } else {
      console.log(`📞 Functions that call '${symbol}' (${callers.length}):\n`);
      if (callers.length === 0) {
        console.log('   No callers found');
      } else {
        callers.forEach(caller => {
          console.log(`   ${caller.symbol} → ${caller.file}:${caller.line}`);
        });
      }
    }
  });

program
  .command('call-chain')
  .description('Show call chain from one symbol to another')
  .argument('<from>', 'Source symbol name')
  .argument('<to>', 'Target symbol name')
  .argument('[path]', 'Project path', '.')
  .option('--json', 'Output as JSON for agent consumption')
  .option('--depth <number>', 'Maximum search depth', '5')
  .action((from: string, to: string, projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    const maxDepth = parseInt(options.depth) || 5;
    
    // Build a call graph for path finding
    const callGraph = new Map<string, string[]>();
    Object.entries(index.files).forEach(([filePath, fileInfo]) => {
      fileInfo.symbols.forEach(sym => {
        if (sym.calls) {
          callGraph.set(sym.name, sym.calls);
        }
        if (sym.children) {
          sym.children.forEach(child => {
            if (child.calls) {
              callGraph.set(`${sym.name}.${child.name}`, child.calls);
            }
          });
        }
      });
    });

    // Find path using BFS
    const findPath = (start: string, end: string): string[] | null => {
      const queue: Array<{ node: string; path: string[] }> = [{ node: start, path: [start] }];
      const visited = new Set<string>();
      
      while (queue.length > 0) {
        const { node, path } = queue.shift()!;
        
        if (node === end) {
          return path;
        }
        
        if (visited.has(node) || path.length > maxDepth) {
          continue;
        }
        
        visited.add(node);
        const calls = callGraph.get(node) || [];
        
        for (const call of calls) {
          if (!visited.has(call)) {
            queue.push({ node: call, path: [...path, call] });
          }
        }
      }
      
      return null;
    };

    const path = findPath(from, to);

    if (options.json) {
      console.log(JSON.stringify({
        from,
        to,
        path,
        found: !!path,
        depth: path ? path.length - 1 : 0
      }, null, 2));
    } else {
      if (path) {
        console.log(`🔗 Call chain from '${from}' to '${to}':\n`);
        path.forEach((symbol, index) => {
          if (index === 0) {
            console.log(`   ${symbol} (start)`);
          } else if (index === path.length - 1) {
            console.log(`   └─ ${symbol} (target)`);
          } else {
            console.log(`   └─ ${symbol}`);
          }
        });
      } else {
        console.log(`❌ No call chain found from '${from}' to '${to}' within depth ${maxDepth}`);
      }
    }
  });

program
  .command('dead-code')
  .description('Find potentially dead code (unused functions)')
  .argument('[path]', 'Project path', '.')
  .option('--json', 'Output as JSON for agent consumption')
  .option('--include-private', 'Include private functions (starting with _)')
  .action((projectPath: string, options) => {
    const config = createConfig(projectPath);
    const indexer = new ProjectIndexer(config);
    const index = indexer.loadIndex();
    
    if (!index) {
      if (options.json) {
        console.log(JSON.stringify({ error: 'No index found' }));
      } else {
        console.log('❌ No index file found. Run "project-index index" first.');
      }
      return;
    }

    // Collect all function/method names
    const allFunctions = new Set<string>();
    const functionLocations = new Map<string, { file: string; line: number }>();
    
    Object.entries(index.files).forEach(([filePath, fileInfo]) => {
      fileInfo.symbols.forEach(sym => {
        if (sym.kind === SymbolKind.Function || sym.kind === SymbolKind.Method) {
          // Skip private functions unless requested
          if (!options.includePrivate && sym.name.startsWith('_')) {
            return;
          }
          
          allFunctions.add(sym.name);
          functionLocations.set(sym.name, { file: filePath, line: sym.line });
        }
        
        if (sym.children) {
          sym.children.forEach(child => {
            if (child.kind === SymbolKind.Method) {
              const fullName = `${sym.name}.${child.name}`;
              if (!options.includePrivate && child.name.startsWith('_')) {
                return;
              }
              
              allFunctions.add(child.name);
              allFunctions.add(fullName);
              functionLocations.set(child.name, { file: filePath, line: child.line });
              functionLocations.set(fullName, { file: filePath, line: child.line });
            }
          });
        }
      });
    });

    // Collect all function calls
    const calledFunctions = new Set<string>();
    Object.entries(index.files).forEach(([filePath, fileInfo]) => {
      fileInfo.symbols.forEach(sym => {
        if (sym.calls) {
          sym.calls.forEach(call => calledFunctions.add(call));
        }
        if (sym.children) {
          sym.children.forEach(child => {
            if (child.calls) {
              child.calls.forEach(call => calledFunctions.add(call));
            }
          });
        }
      });
    });

    // Find uncalled functions
    const deadFunctions = Array.from(allFunctions).filter(func => !calledFunctions.has(func));
    const deadFunctionDetails = deadFunctions.map(func => ({
      name: func,
      location: functionLocations.get(func) || { file: 'unknown', line: 0 }
    }));

    if (options.json) {
      console.log(JSON.stringify({
        deadFunctions: deadFunctionDetails,
        count: deadFunctions.length,
        totalFunctions: allFunctions.size,
        analysis: {
          includePrivate: !!options.includePrivate
        }
      }, null, 2));
    } else {
      console.log(`💀 Potentially dead functions (${deadFunctions.length}/${allFunctions.size}):\n`);
      if (deadFunctions.length === 0) {
        console.log('   No dead functions found');
      } else {
        deadFunctionDetails.forEach(func => {
          console.log(`   ${func.name} → ${func.location.file}:${func.location.line}`);
        });
      }
      
      if (!options.includePrivate) {
        console.log('\n💡 Use --include-private to include private functions');
      }
    }
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(`❌ ${str}`),
});

program.parse();
