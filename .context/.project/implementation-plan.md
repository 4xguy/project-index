# Project Index Implementation Plan

## Overview
A comprehensive plan for building an efficient project indexing system that minimizes token consumption while providing rich codebase understanding for Claude Code and AI agents.

## Token Consumption Analysis

### Non-Token Consuming Components (95%)
These components can be implemented as pure deterministic code without AI:

1. **Core Indexing Engine**
   - LSP-based symbol extraction (following Serena's approach)
   - AST parsing via language servers
   - File system operations and watching
   - Symbol hierarchies and relationships
   - Incremental caching mechanisms
   - Dependency graph construction

2. **Language-Specific Parsers**
   - TypeScript/JavaScript: ts-morph, typescript compiler API
   - Python: ast module, jedi, pygments
   - Go: go/parser, go/ast packages
   - Java/C#: tree-sitter, roslyn
   - All provide deterministic symbol extraction

3. **Data Structures & Storage**
   - PROJECT_INDEX.json generation
   - Symbol location tracking (file:line:column)
   - Import/export mappings
   - Cross-reference indices
   - File hash-based change detection

4. **Performance Features** (From Serena insights)
   - Incremental updates (every 10 files)
   - Lazy loading of symbol bodies
   - Cache invalidation by file hash
   - Parallel file processing

### Token-Consuming Components (5%)
Optional AI enhancements that add semantic understanding:

1. **Semantic Understanding**
   - Pattern recognition ("This looks like a React component")
   - Architecture inference ("This follows MVC pattern")
   - Code smell detection

2. **Claude's Consumption**
   - Reading PROJECT_INDEX.json
   - Planning minimal change sets
   - Understanding project structure

## Implementation Phases

### Phase 1: Core Token-Free Indexer

#### 1.1 LSP-Based Symbol Extraction
- Implement `LanguageServerManager` using existing LSP servers
- Support TypeScript, Python, Go, Java via respective LSPs
- Extract symbols, signatures, imports/exports, line ranges
- No AI tokens needed - pure deterministic parsing

#### 1.2 Index Data Structure
```json
{
  "schemaVersion": "1.0",
  "projectRoot": "/path/to/project",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "files": {
    "src/file.ts": {
      "path": "src/file.ts",
      "language": "typescript",
      "size": 1234,
      "hash": "abc123def456",
      "lastIndexedAt": "2024-01-01T00:00:00Z",
      "imports": [
        {"module": "react", "symbols": ["useState", "useEffect"]}
      ],
      "exports": [
        {"name": "MyComponent", "type": "function", "line": 10}
      ],
      "symbols": [
        {
          "name": "MyComponent",
          "kind": "function",
          "line": 10,
          "column": 0,
          "endLine": 50,
          "signature": "function MyComponent(props: Props): JSX.Element",
          "docstring": "Main component for...",
          "children": [
            {"name": "handleClick", "kind": "function", "line": 15}
          ]
        }
      ],
      "outline": [
        {"type": "import", "lines": [1, 5]},
        {"type": "function", "lines": [10, 50]},
        {"type": "export", "lines": [52, 52]}
      ]
    }
  },
  "symbolIndex": {
    "MyComponent": ["src/file.ts:10"],
    "handleClick": ["src/file.ts:15"]
  },
  "dependencyGraph": {
    "src/file.ts": {
      "imports": ["react", "src/utils.ts"],
      "importedBy": ["src/app.ts"]
    }
  }
}
```

#### 1.3 File Watcher & Incremental Updates
- Use chokidar for cross-platform file watching
- Batch updates every 10 files (Serena's optimization)
- Cache parsing results by file hash
- Debounce rapid changes (100ms delay)
- Only reparse changed files

### Phase 2: MCP Server Integration

#### 2.1 Expose as MCP Tools
Following Serena's pattern, expose indexing as MCP tools:

```typescript
// MCP Tool Definitions
tools: [
  {
    name: "index_project",
    description: "Perform full project indexing",
    parameters: {
      path: { type: "string" },
      includeTests: { type: "boolean", default: false }
    }
  },
  {
    name: "find_symbol",
    description: "Find symbols by name or pattern",
    parameters: {
      name: { type: "string" },
      kind: { type: "string", optional: true },
      includeBody: { type: "boolean", default: false }
    }
  },
  {
    name: "get_dependencies",
    description: "Get dependency graph for a file",
    parameters: {
      file: { type: "string" }
    }
  },
  {
    name: "get_file_outline",
    description: "Get structural outline of a file",
    parameters: {
      file: { type: "string" }
    }
  }
]
```

#### 2.2 Claude Code Hook Integration
- Background daemon process
- Auto-updates PROJECT_INDEX.json on file changes
- Zero context pollution (runs outside Claude)
- Configurable via `.claude/hooks.json`

### Phase 3: Claude Integration

#### 3.1 Slash Commands
```yaml
/index-status: Check index health and stats
/index-refresh: Force full reindex
/index-query: Query symbols by pattern
/index-analyze: AI analysis of codebase structure
```

#### 3.2 Sub-agent Templates

**Index Reader Agent**
```markdown
Role: Read PROJECT_INDEX.json and identify relevant files for a task
Input: Task description
Output: Minimal set of files and line ranges
```

**Change Planner Agent**
```markdown
Role: Use index to plan precise code changes
Input: Feature request or bug description
Output: Exact files, symbols, and line ranges to modify
```

## Implementation Stack

### Core Technologies
- **Language**: TypeScript (best LSP tooling and ecosystem)
- **LSP Libraries**: 
  - vscode-languageserver-node
  - typescript language service
  - python-lsp-server (pylsp)
  - gopls for Go
- **File Watching**: chokidar (cross-platform)
- **Storage**: JSON with optional MessagePack compression
- **MCP Framework**: @modelcontextprotocol/sdk

### Language-Specific Parsers
- **TypeScript/JavaScript**: @typescript/compiler, ts-morph
- **Python**: ast, jedi, tree-sitter-python
- **Go**: go/parser, go/ast
- **Java**: tree-sitter-java, eclipse JDT
- **Rust**: rust-analyzer LSP
- **C/C++**: clangd LSP

## Key Design Decisions

### 1. LSP-First Approach
Following Serena's success, use Language Server Protocol for robust, language-agnostic parsing. LSPs provide:
- Accurate symbol extraction
- Cross-reference resolution
- Type information
- Documentation extraction

### 2. Incremental by Default
- Update in batches of 10 files
- Cache aggressively using file hashes
- Only reparse changed files
- Debounce filesystem events

### 3. Token-Free Core
- 95% of functionality runs without AI
- Deterministic parsing and indexing
- Only planning and semantic analysis use tokens

### 4. MCP Native
- All functionality exposed as MCP tools
- Compatible with Claude Code and other MCP clients
- Standardized tool interfaces

### 5. Hook Automation
- File watcher runs as daemon
- Updates index automatically
- No manual intervention needed
- Zero context pollution

## Performance Targets

### Indexing Speed
- Initial index: < 1 second per 100 files
- Incremental update: < 100ms per file
- Symbol search: < 50ms for 10,000 symbols

### Memory Usage
- Index size: ~1KB per source file
- Memory footprint: < 100MB for 10,000 files
- Cache size: Configurable (default 50MB)

### Token Efficiency
- Zero tokens for indexing operations
- < 1K tokens to read index summary
- < 5K tokens for complex planning operations

## Monitoring & Metrics

### Index Health Metrics
- Files indexed vs total
- Last update timestamp
- Symbol count by type
- Dependency graph connectivity
- Cache hit rate

### Performance Metrics
- Indexing time per file
- Update latency
- Search query time
- Memory usage
- Disk I/O

## Error Handling & Recovery

### Graceful Degradation
- Partial indexing on parser failures
- Fallback to basic file listing
- Continue indexing despite individual file errors

### Recovery Mechanisms
- Automatic reindex on corruption
- Incremental repair of damaged indices
- Transaction log for crash recovery

## Security Considerations

### Path Restrictions
- Honor .gitignore patterns
- Configurable exclude patterns
- No indexing of sensitive files (.env, keys)

### Resource Limits
- Maximum file size (default 10MB)
- Maximum project size (default 1GB)
- Rate limiting for updates

## Future Enhancements

### Phase 4: Advanced Features
- Semantic code search using embeddings
- Cross-project dependency tracking
- Historical index snapshots
- Real-time collaboration features

### Phase 5: AI Integration
- Automatic refactoring suggestions
- Code quality metrics
- Architecture visualization
- Pattern detection and alerts

## Conclusion

This implementation plan provides a robust, efficient project indexing system that:
- Operates with 95% token-free efficiency
- Provides rich codebase understanding
- Integrates seamlessly with Claude Code
- Scales to large projects
- Maintains zero context pollution

The core insight from Serena and Eric's approach: **Keep heavy processing outside Claude's context, provide rich structured data on demand.**