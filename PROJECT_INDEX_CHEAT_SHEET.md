# Project Index Cheat Sheet

## Quick Reference

### Basic Commands
```bash
project-index status              # Show index status and statistics
project-index search <query>      # Search for symbols/files
project-index search -e "exact"   # Exact match search
project-index index               # Rebuild full index (force reindex)
project-index deps <file>         # Show dependency relationships for a file
project-index impact <file>       # Analyze change impact for a file
project-index suggest <context>   # Agent-friendly context suggestions
project-index calls <symbol>      # Outgoing call graph for a symbol
project-index called-by <symbol>  # Incoming call graph for a symbol
```

### Search Options
```bash
project-index search "AuthManager"           # Find AuthManager symbol
project-index search "login"                 # Find anything containing "login"
project-index search -e "ProjectIndexer"     # Exact match for ProjectIndexer
project-index search "query" --json          # JSON output for programmatic use
```

## Index Structure

### Location
- **Index File**: `.context/.project/PROJECT_INDEX.json`
- **Auto-loaded**: Available at session start
- **Auto-updates**: Hooks update after Write/Edit operations

### Key Data
- **Files**: Total indexed files count
- **Symbols**: All discoverable symbols (functions, classes, methods, etc.)
- **Last Updated**: Timestamp of last index update

## Symbol Discovery

### Instant Lookups
```javascript
// Access via loaded PROJECT_INDEX.json
symbolIndex["AuthManager"]  // → "src/auth/login.ts:45"
symbolIndex["createConfig"] // → "src/config.ts:12"
```

### File Relationships
- **Exports**: What each file exports
- **Imports**: What each file imports
- **Dependencies**: File dependency graph

## Use Cases

### 1. Find Symbol Location
```bash
project-index search "ProjectIndexer.indexFile"
# Returns: src/core/indexer.ts:89
```

### 2. Zero-Token Discovery
Instead of file searches, use:
```bash
project-index search --json "query"
# Returns structured symbol locations without reading files
```

### 3. Code Navigation
```bash
project-index search "IndexWatcher"
# Find: src/core/watcher.ts:8
```

### 4. Architecture Overview
```bash
project-index status
# Shows:
# - Key directories
# - Main entry points  
# - Symbol distribution
# - Index health
```

## Advanced Usage

### JSON Output Format
```bash
project-index search "config" --json
```
Returns:
```json
{
  "matches": [
    {
      "symbol": "createConfig",
      "file": "src/config.ts",
      "line": 12,
      "type": "function"
    }
  ]
}
```

### Integration with Claude Code
- **Memory-efficient**: Use instead of file reads for symbol discovery
- **Context protection**: Prevents unnecessary file loading
- **Task coordination**: Supports parallel agent execution

## Tips & Best Practices

### When to Use
- ✅ Finding symbol definitions
- ✅ Code navigation
- ✅ Architecture exploration
- ✅ Zero-token symbol discovery

### When NOT to Use
- ❌ Reading file contents (use Read tool)
- ❌ Understanding implementation details
- ❌ Complex code analysis

### Performance Tips
1. Use `--json` for programmatic access
2. Prefer exact matches (`-e`) when possible
3. Check index status if results seem stale
4. Let auto-updates handle index maintenance

## Troubleshooting

### Stale Results
```bash
project-index index  # Force rebuild
```

### Missing Symbols
- Check if file is in supported language
- Verify file is not in `.gitignore`
- Run status to see index coverage

### Performance Issues
- Index rebuilds automatically on file changes
- Large codebases may take time to index
- Use specific search terms to narrow results

## Integration Examples

### With Memory-MCP
```bash
# Store frequently used symbol locations
mcp__memory-mcp__storeMemory domain:"technical" 
# Content: project_symbols = {"auth": "src/auth/", "core": "src/core/"}
```

### With Task Workers
```bash
# Use in parallel task execution
project-index search --json "target_symbol" | parse_for_agents
```

## Supported Languages
- **TypeScript/JavaScript**: Full support with React components, API endpoints
- **Python**: Enhanced AST parsing with classes, methods, imports/exports
- **Go**: Full support with structs, interfaces, methods, packages, exports
- **Rust**: Full support with structs, enums, traits, impl blocks, modules
- **Shell/Bash**: Basic support with functions and commands

### Language-Specific Examples

#### Go Symbol Discovery
```bash
project-index search "UserService"     # Find Go interfaces
project-index search "NewUser"         # Find Go constructors  
project-index search "handleUsers"     # Find Go HTTP handlers
```

#### Rust Symbol Discovery
```bash
project-index search "UserService"     # Find Rust traits
project-index search "impl"            # Find implementation blocks
project-index search "pub struct"      # Find public structs
```

#### Python Symbol Discovery
```bash
project-index search "class User"      # Find Python classes
project-index search "def process"     # Find Python functions
project-index search "__init__"        # Find constructors
```

---

## Environment Quick Start (v1.2.0)

- Node: use `nvm use 20` (pinned via `.nvmrc`)
- Toolchain: `build-essential`, `python3`, `pkg-config`
- Install: `npm install --legacy-peer-deps`
- Rebuild natives after install:  
  `npm rebuild tree-sitter tree-sitter-go tree-sitter-rust --build-from-source`

**Note**: Advanced commands (`deps`, `impact`, `suggest`, `calls`, `called-by`, `call-chain`, `dead-code`) are available now in v1.2.0.

## Common Workflows

- **Fresh setup + index**  
  ```bash
  nvm use 20
  npm install --legacy-peer-deps
  npm run build
  project-index index .
  ```

- **Find impact of a change**  
  ```bash
  project-index impact src/core/indexer.ts
  ```

- **Dependency check for a file**  
  ```bash
  project-index deps src/core/indexer.ts
  ```

- **Call graph hop**  
  ```bash
  project-index calls ProjectIndexer.indexProject
  project-index called-by ProjectIndexer.indexProject
  project-index call-chain A B
  ```

- **Quick symbol search (JSON for tooling)**  
  ```bash
  project-index search --json "ProjectIndexer"
  ```
