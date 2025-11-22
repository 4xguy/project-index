#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { ProjectIndexer } from './core/indexer';
import { IndexerConfig } from './types/index';

class ProjectIndexMCPServer {
  private server: Server;
  private indexer: ProjectIndexer | null = null;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.server = new Server(
      {
        name: 'project-index',
        version: '1.2.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  private getIndexer(): ProjectIndexer {
    if (!this.indexer) {
      const config: IndexerConfig = {
        projectRoot: resolve(this.projectRoot),
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
      this.indexer = new ProjectIndexer(config);
    }
    return this.indexer;
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'index-project',
            description: 'Index the entire project and create symbol index',
            inputSchema: {
              type: 'object',
              properties: {
                force: {
                  type: 'boolean',
                  description: 'Force rebuild even if index exists',
                  default: false
                }
              }
            },
          },
          {
            name: 'search-symbols',
            description: 'Search for symbols in the project index',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Symbol name or pattern to search for'
                },
                exact: {
                  type: 'boolean',
                  description: 'Exact match only',
                  default: false
                }
              },
              required: ['query']
            },
          },
          {
            name: 'get-dependencies',
            description: 'Get dependency information for a file',
            inputSchema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  description: 'File path to analyze'
                },
                reverse: {
                  type: 'boolean',
                  description: 'Show what depends on this file',
                  default: false
                }
              },
              required: ['file']
            },
          },
          {
            name: 'analyze-impact',
            description: 'Analyze change impact for a file',
            inputSchema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  description: 'File path to analyze impact for'
                },
                depth: {
                  type: 'number',
                  description: 'Dependency depth to analyze',
                  default: 2
                }
              },
              required: ['file']
            },
          },
          {
            name: 'get-file-info',
            description: 'Get detailed information about a specific file',
            inputSchema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  description: 'File path to get information for'
                }
              },
              required: ['file']
            },
          },
          {
            name: 'suggest-context',
            description: 'Get smart context suggestions for agents',
            inputSchema: {
              type: 'object',
              properties: {
                context: {
                  type: 'string',
                  description: 'Context query (e.g., "auth", "api", "components")'
                }
              },
              required: ['context']
            },
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'index-project':
            return await this.handleIndexProject(args);
          case 'search-symbols':
            return await this.handleSearchSymbols(args);
          case 'get-dependencies':
            return await this.handleGetDependencies(args);
          case 'analyze-impact':
            return await this.handleAnalyzeImpact(args);
          case 'get-file-info':
            return await this.handleGetFileInfo(args);
          case 'suggest-context':
            return await this.handleSuggestContext(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'project-index://project-index',
            name: 'Full Project Index',
            description: 'Complete project index with files, symbols, and dependencies',
            mimeType: 'application/json',
          },
          {
            uri: 'project-index://file-list',
            name: 'File List',
            description: 'List of all indexed files',
            mimeType: 'application/json',
          },
          {
            uri: 'project-index://symbol-index',
            name: 'Symbol Index',
            description: 'Symbol name to location mapping',
            mimeType: 'application/json',
          },
          {
            uri: 'project-index://dependency-graph',
            name: 'Dependency Graph',
            description: 'File dependency relationships',
            mimeType: 'application/json',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        const indexer = this.getIndexer();
        const index = indexer.loadIndex();

        if (!index) {
          throw new Error('No project index found. Run index-project tool first.');
        }

        switch (uri) {
          case 'project-index://project-index':
            return {
              contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(index, null, 2),
              }],
            };
          case 'project-index://file-list':
            return {
              contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(Object.keys(index.files), null, 2),
              }],
            };
          case 'project-index://symbol-index':
            return {
              contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(index.symbolIndex, null, 2),
              }],
            };
          case 'project-index://dependency-graph':
            return {
              contents: [{
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(index.dependencyGraph, null, 2),
              }],
            };
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        throw new Error(`Error reading resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private async handleIndexProject(args: any) {
    const indexer = this.getIndexer();
    const indexPath = join(this.projectRoot, '.context/.project/PROJECT_INDEX.json');
    
    if (!args.force && existsSync(indexPath)) {
      return {
        content: [{
          type: 'text',
          text: 'Project index already exists. Use force: true to rebuild.'
        }],
      };
    }

    const index = await indexer.indexProject();
    indexer.saveIndex(index);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: 'Project indexed successfully',
          stats: {
            files: Object.keys(index.files).length,
            symbols: Object.keys(index.symbolIndex).length,
            dependencies: Object.keys(index.dependencyGraph).length,
            updatedAt: index.updatedAt
          }
        }, null, 2)
      }],
    };
  }

  private async handleSearchSymbols(args: any) {
    const { query, exact = false } = args;
    const indexer = this.getIndexer();
    const index = indexer.loadIndex();

    if (!index) {
      throw new Error('No project index found. Run index-project tool first.');
    }

    const results = Object.entries(index.symbolIndex).filter(([symbol, location]) => {
      return exact 
        ? symbol === query
        : symbol.toLowerCase().includes(query.toLowerCase());
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          query,
          exact,
          results: results.map(([symbol, location]) => ({ symbol, location })),
          count: results.length
        }, null, 2)
      }],
    };
  }

  private async handleGetDependencies(args: any) {
    const { file, reverse = false } = args;
    const indexer = this.getIndexer();
    const index = indexer.loadIndex();

    if (!index) {
      throw new Error('No project index found. Run index-project tool first.');
    }

    const normalizedFile = file.startsWith('./') ? file.substring(2) : file;
    const deps = index.dependencyGraph[normalizedFile];

    if (!deps) {
      throw new Error(`File not found in dependency graph: ${normalizedFile}`);
    }

    if (reverse) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            file: normalizedFile,
            importedBy: deps.importedBy,
            count: deps.importedBy.length
          }, null, 2)
        }],
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            file: normalizedFile,
            imports: deps.imports,
            count: deps.imports.length
          }, null, 2)
        }],
      };
    }
  }

  private async handleAnalyzeImpact(args: any) {
    const { file, depth = 2 } = args;
    const indexer = this.getIndexer();
    const index = indexer.loadIndex();

    if (!index) {
      throw new Error('No project index found. Run index-project tool first.');
    }

    const normalizedFile = file.startsWith('./') ? file.substring(2) : file;
    const deps = index.dependencyGraph[normalizedFile];

    if (!deps) {
      throw new Error(`File not found in dependency graph: ${normalizedFile}`);
    }

    // Simple impact analysis - this could be enhanced with the full algorithm from CLI
    const highImpact = deps.importedBy;
    const mediumImpact: string[] = [];
    const lowImpact: string[] = [];

    // Basic recursive analysis (simplified)
    deps.importedBy.forEach(importingFile => {
      const fileDeps = index.dependencyGraph[importingFile];
      if (fileDeps) {
        mediumImpact.push(...fileDeps.importedBy);
      }
    });

    const testFiles = Object.keys(index.files).filter(f => 
      (f.includes('.test.') || f.includes('.spec.') || f.includes('/test/'))
    );

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          file: normalizedFile,
          impact: {
            high: [...new Set(highImpact)],
            medium: [...new Set(mediumImpact)].filter(f => !highImpact.includes(f)),
            low: [...new Set(lowImpact)]
          },
          tests: testFiles,
          totalAffected: highImpact.length + mediumImpact.length + lowImpact.length,
          analysisDepth: depth
        }, null, 2)
      }],
    };
  }

  private async handleGetFileInfo(args: any) {
    const { file } = args;
    const indexer = this.getIndexer();
    const index = indexer.loadIndex();

    if (!index) {
      throw new Error('No project index found. Run index-project tool first.');
    }

    const normalizedFile = file.startsWith('./') ? file.substring(2) : file;
    const fileInfo = index.files[normalizedFile];

    if (!fileInfo) {
      throw new Error(`File not found in index: ${normalizedFile}`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(fileInfo, null, 2)
      }],
    };
  }

  private async handleSuggestContext(args: any) {
    const { context } = args;
    const indexer = this.getIndexer();
    const index = indexer.loadIndex();

    if (!index) {
      throw new Error('No project index found. Run index-project tool first.');
    }

    const contextLower = context.toLowerCase();
    const allSymbols = Object.entries(index.symbolIndex);
    
    // Score symbols based on relevance to context (simplified from CLI)
    const scoredSymbols = allSymbols.map(([symbol, location]) => {
      let score = 0;
      const symbolLower = symbol.toLowerCase();
      
      if (symbolLower.includes(contextLower)) {
        score += 100;
      }
      
      // Basic pattern matching
      const patterns = {
        'auth': ['login', 'signin', 'auth', 'user', 'session', 'token'],
        'api': ['api', 'endpoint', 'route', 'service', 'client', 'request'],
        'component': ['component', 'button', 'form', 'modal', 'card', 'layout'],
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

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          context,
          primary: primary.map(item => ({ 
            symbol: item.symbol, 
            location: item.location, 
            confidence: Math.min(item.score / 100, 1) 
          })),
          related: related.map(item => ({ 
            symbol: item.symbol, 
            location: item.location, 
            confidence: Math.min(item.score / 100, 1) 
          })),
          total_matches: scoredSymbols.length
        }, null, 2)
      }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Run the server
const server = new ProjectIndexMCPServer();
server.run().catch(console.error);