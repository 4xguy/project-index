---
Document Version: 1.0
Created: 2025-11-22T02:39:35.430150+00:00
Modified: 2025-11-22T02:39:35.430150+00:00
Modifications: 0
---
# Validation & Architecture Quick Reference

**Last Updated**: 2025-11-21

## Build & Development Commands

```bash
# Compilation
npm run build              # TypeScript → dist/ (TS strict mode validates)
npm run watch              # Incremental compilation
npm run dev                # ts-node execution (TypeScript direct)

# MCP Server
npm run mcp-server         # Production MCP server (compiled)
npm run mcp-dev            # Development MCP server (ts-node)

# CLI Usage
npm start                  # Run CLI from dist/
project-index index        # Full indexing
project-index watch        # File watcher
project-index search       # Symbol search
project-index suggest      # AI context suggestions
```

## Environment Prerequisites (validated 2025-11-22)

- Node: 20.19.5 via `nvm use` (pinned in `.nvmrc`)
- Native toolchain: `build-essential`, `python3`, `pkg-config`
- Install: `npm install --legacy-peer-deps`
- Rebuild natives after install: `npm rebuild tree-sitter tree-sitter-go tree-sitter-rust --build-from-source`

## Validation Tools Status

| Tool | Command | Status |
|------|---------|--------|
| **TypeScript** | `npm run build` | ✅ Strict mode enabled |
| **Jest Tests** | `npm test` | ⚠️ Zero tests configured |
| **Linting** | N/A | ❌ Not configured |
| **CI/CD** | N/A | ❌ No workflows |

## Language Support

```
TypeScript/JavaScript/TSX/JSX  → ts-morph (AST)
Python                          → python-ast (AST)
Go                              → tree-sitter-go
Rust                            → tree-sitter-rust
Shell/Bash                      → Custom parser
```

## Core Components

```
src/cli.ts              → 15+ CLI commands
src/mcp-server.ts       → MCP server implementation
src/core/indexer.ts     → Main indexing engine
src/core/watcher.ts     → File watcher (chokidar)
src/parsers/*           → 5 language parsers
src/types/index.ts      → Type definitions
```

## Key Data Structures

```typescript
ProjectIndex {
  files: FileInfo[]           // File metadata + symbols
  symbolIndex: Map            // "name" → "file:line"
  dependencyGraph: Map        // Import relationships
}

FileInfo {
  imports, exports, symbols
  reactComponents?            // React detection
  apiEndpoints?               // API detection
}

SymbolInfo {
  name, kind, line, signature
  calls, calledBy              // Call graph
}
```

## Output Location

```
.context/.project/PROJECT_INDEX.json
```

## Critical Gaps

- ❌ No unit tests (0 test files)
- ❌ No integration tests
- ❌ No CI/CD pipeline
- ❌ No linting/formatting

## Index Metrics

- **Size**: 2-5K tokens (constant)
- **Speed**: ~100 files/sec (TypeScript)
- **Update**: <500ms (incremental, debounced)
- **Language**: 5 supported

---

See `VALIDATION_AND_ARCHITECTURE.md` for detailed analysis.
