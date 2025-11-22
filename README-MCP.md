# Project Index MCP Server

This package provides an MCP (Model Context Protocol) server that exposes the project-index functionality to Claude Code and other MCP-compatible clients. The server allows AI assistants to intelligently navigate and understand codebases through structured indexing and symbol extraction.

## Features

- **6 MCP Tools** for interactive project analysis
- **4 MCP Resources** for accessing indexed data
- **Multi-language support** (TypeScript, JavaScript, Python, Go, Rust, Shell)
- **Real-time indexing** with incremental updates
- **Symbol extraction** with AST parsing
- **Dependency graph** analysis
- **React component** and **API endpoint** detection

## Installation

```bash
# Install globally
npm install -g project-index

# Or install locally in your project
npm install project-index
```

## Quick Start

### 1. Start the MCP Server

```bash
# Using npm script (after building)
npm run mcp-server

# Or using the global binary
project-index-mcp

# Or in development mode
npm run mcp-dev
```

### 2. Configure MCP Client

Add the server to your MCP client configuration (e.g., Claude Code):

```json
{
  "mcpServers": {
    "project-index": {
      "command": "project-index-mcp",
      "args": []
    }
  }
}
```

### 3. Index Your Project

The server will automatically index the current working directory when tools are called. You can also force a rebuild:

```bash
# Create initial index
project-index index
```

## MCP Tools

The server provides 6 interactive tools that can be called by MCP clients:

### 1. `index-project`
Creates or updates the project index.

**Parameters:**
- `force` (boolean, optional): Force rebuild even if index exists

**Example:**
```javascript
// Force rebuild the entire index
await callTool('index-project', { force: true });
```

### 2. `search-symbols`
Search for symbols in the project index.

**Parameters:**
- `query` (string, required): Symbol name or pattern to search for
- `exact` (boolean, optional): Exact match only

**Example:**
```javascript
// Find all symbols containing "auth"
await callTool('search-symbols', { query: 'auth' });

// Find exact match for "AuthManager"
await callTool('search-symbols', { query: 'AuthManager', exact: true });
```

### 3. `get-dependencies`
Get dependency information for a specific file.

**Parameters:**
- `file` (string, required): File path to analyze
- `reverse` (boolean, optional): Show what depends on this file

**Example:**
```javascript
// Get what this file imports
await callTool('get-dependencies', { file: 'src/auth/login.ts' });

// Get what files import this file
await callTool('get-dependencies', { file: 'src/auth/login.ts', reverse: true });
```

### 4. `analyze-impact`
Analyze the potential impact of changing a file.

**Parameters:**
- `file` (string, required): File path to analyze impact for
- `depth` (number, optional): Dependency depth to analyze (default: 2)

**Example:**
```javascript
// Analyze impact of changing auth module
await callTool('analyze-impact', { file: 'src/auth/index.ts', depth: 3 });
```

### 5. `get-file-info`
Get detailed information about a specific file.

**Parameters:**
- `file` (string, required): File path to get information for

**Example:**
```javascript
// Get complete file information
await callTool('get-file-info', { file: 'src/components/Button.tsx' });
```

### 6. `suggest-context`
Get smart context suggestions for development tasks.

**Parameters:**
- `context` (string, required): Context query (e.g., "auth", "api", "components")

**Example:**
```javascript
// Get relevant files for authentication work
await callTool('suggest-context', { context: 'auth' });

// Get API-related symbols and files
await callTool('suggest-context', { context: 'api' });
```

## MCP Resources

The server provides 4 read-only resources for accessing structured index data:

### 1. `project-index://project-index`
Complete project index with all files, symbols, and dependencies.

### 2. `project-index://file-list`
List of all indexed files in the project.

### 3. `project-index://symbol-index`
Symbol name to location mapping for quick lookups.

### 4. `project-index://dependency-graph`
File dependency relationships and import/export mappings.

## Integration Examples

### Claude Code Integration

1. Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "project-index": {
      "command": "project-index-mcp",
      "args": []
    }
  }
}
```

2. Initialize project indexing:

```bash
project-index-init
```

3. Start Claude Code - the index will be automatically loaded.

### Custom MCP Client

```typescript
import { MCPClient } from '@modelcontextprotocol/client';

// Connect to the project-index server
const client = new MCPClient();
await client.connect('project-index-mcp');

// Search for authentication-related symbols
const authSymbols = await client.callTool('search-symbols', {
  query: 'auth'
});

// Get file dependencies
const deps = await client.callTool('get-dependencies', {
  file: 'src/auth/login.ts'
});

// Read the complete project index
const fullIndex = await client.readResource('project-index://project-index');
```

## Configuration

The server uses the same configuration as the CLI tool. Create a `.projectindex.config.js` file in your project root:

```javascript
module.exports = {
  excludePatterns: [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '**/*.test.{ts,tsx,js,jsx}'
  ],
  includePatterns: ['**/*.{ts,tsx,js,jsx,py,go,rs}'],
  maxFileSize: 1024 * 1024, // 1MB
  languages: ['typescript', 'javascript', 'python', 'go', 'rust']
};
```

## Supported Languages

- **TypeScript/JavaScript**: Full AST parsing with React component detection
- **Python**: AST-based symbol extraction and import analysis
- **Go**: Tree-sitter parsing for functions, types, and packages
- **Rust**: Tree-sitter parsing for functions, structs, and modules
- **Shell**: Basic function and script analysis

## Output Formats

All tools return structured JSON data optimized for AI consumption:

```json
{
  "query": "auth",
  "exact": false,
  "results": [
    {
      "symbol": "AuthManager",
      "location": "src/auth/manager.ts:15"
    },
    {
      "symbol": "authenticateUser",
      "location": "src/auth/utils.ts:42"
    }
  ],
  "count": 2
}
```

## Performance

- **Fast startup**: Index loading in <100ms for medium projects
- **Incremental updates**: Only re-parse changed files
- **Memory efficient**: Optimized data structures for large codebases
- **Symbol caching**: Quick lookups via pre-built symbol index

## Troubleshooting

### Server Won't Start

```bash
# Check if TypeScript compiled correctly
npm run build

# Test in development mode
npm run mcp-dev

# Check for port conflicts (if using HTTP transport)
lsof -i :3000
```

### Index Issues

```bash
# Force rebuild the index
project-index index --force

# Check index status
project-index status

# Verify file patterns
project-index search "YourSymbol" --json
```

### Memory Issues

```bash
# Reduce file size limit in config
maxFileSize: 512 * 1024  // 512KB instead of 1MB

# Add more exclude patterns
excludePatterns: ['**/*.d.ts', 'coverage/**']
```

## Development

### Building

```bash
npm run build        # Compile TypeScript
npm run watch        # Watch mode for development
npm test            # Run test suite
```

### Testing the MCP Server

```bash
# Start in development mode
npm run mcp-dev

# Test specific tools
echo '{"method": "tools/list"}' | npm run mcp-server

# Check server health
project-index status
```

## API Reference

### Tool Responses

All tools return responses in this format:

```typescript
interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string; // JSON-encoded result
  }>;
  isError?: boolean;
}
```

### Resource Responses

Resources return structured data:

```typescript
interface ResourceResponse {
  contents: Array<{
    uri: string;
    mimeType: 'application/json';
    text: string; // JSON-encoded data
  }>;
}
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

- [GitHub Issues](https://github.com/4xguy/project-index/issues)
- [Documentation](https://github.com/4xguy/project-index#readme)
- [MCP Protocol Specification](https://modelcontextprotocol.io)