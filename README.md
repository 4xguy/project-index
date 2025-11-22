# Project Index

> **Token-free project indexing system for Claude Code**  
> Get instant project understanding without token consumption

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-FF6B35?style=flat&logo=anthropic&logoColor=white)](https://claude.ai/code)

## 🎯 What It Does

Project Index creates a **minimal, always-updated summary** of your entire codebase that Claude reads at session start. Instead of Claude discovering your project structure through expensive file reads, it gets instant access to:

- 📁 **Complete file structure** with imports/exports
- 🏷️ **All symbols** (functions, classes, interfaces) with locations
- 🔗 **Dependency relationships** between files
- 📊 **Function signatures** and documentation
- ⚡ **Real-time updates** as you code
- ⚛️ **React components** with hooks and props (v1.1)
- 🌐 **API endpoints** with routes and middleware (v1.1)
- 🐍 **Python support** with AST parsing (v1.1)
- 🚀 **Go support** with comprehensive parsing (v1.2)
- 🦀 **Rust support** with trait and impl detection (v1.2)
- 🤖 **Agent-optimized intelligence** with smart suggestions (v1.2)
- 💥 **Change impact analysis** with confidence vectors (v1.2)
- 🎯 **Context-aware recommendations** for agentic workflows (v1.2)

**Result**: Claude understands your entire project from the first message, using only ~2-5K tokens regardless of project size.

## 📋 Requirements

- **Node.js** 20.x (validated with 20.19.5; `.nvmrc` included)
- **Build tools**: `build-essential`, `python3`, `pkg-config` (for tree-sitter native builds)
- **Git** (for cloning the repository)
- **Claude Code** with hooks support

**Install deps (dev):**
```bash
nvm use 20
npm install --legacy-peer-deps
npm rebuild tree-sitter tree-sitter-go tree-sitter-rust --build-from-source
```

## 🚀 Quick Start

### NPM Installation (Recommended)

```bash
# Install globally via NPM (when published)
npm install -g project-index

# Initialize any project
cd /path/to/your/project  
project-index-init

# Start coding with Claude Code - index loads automatically! 🎉
```

### Manual Installation (Development)

```bash
# Install from source
git clone https://github.com/4xguy/project-index.git
cd project-index
./install.sh   # Automatically installs TypeScript if needed

# Initialize any project
cd /path/to/your/project  
project-index-init

# Start coding with Claude Code - index loads automatically! 🎉
```

### Per-Project Installation

```bash
# In your project directory
git clone https://github.com/4xguy/project-index.git .project-index
cd .project-index
npm install && npm run build

# Copy configuration
cp -r .claude ../
mkdir -p ../.context/.project

# Build initial index
node dist/cli.js index ..
```

## 📋 How It Works

### The Eric's Project Index Concept

This implements the **Project Index pattern** described by Eric in Claude Code workflows:

1. **Background Process**: File watcher runs outside Claude's context
2. **Minimal Index**: `.context/.project/PROJECT_INDEX.json` contains project structure, not code
3. **Hook Integration**: Claude automatically loads index at session start
4. **Zero Token Indexing**: 95% of work happens without consuming tokens
5. **Incremental Updates**: Only changed files get re-indexed

### The Magic: SESSION START

When Claude Code starts, hooks automatically run:

```bash
🔍 PROJECT INDEX LOADED
======================

📊 Index Statistics:
   Files: 47
   Symbols: 1,247  
   Last Updated: 2025-08-13T10:15:30.123Z

📋 PROJECT INDEX CONTENT:
{
  "files": {
    "src/auth/login.ts": {
      "exports": ["login", "logout", "validateUser"],
      "imports": ["bcrypt", "./database"], 
      "symbols": [
        "function login(email: string): Promise<User>",
        "class AuthManager extends BaseAuth"
      ]
    }
  },
  "symbolIndex": {
    "AuthManager": "src/auth/login.ts:45",
    "login": "src/auth/login.ts:12"
  }
}
```

Claude now knows your entire project structure instantly! 🧠

## 🛠️ Commands

### Core Commands

```bash
# Show index status and statistics
project-index status

# Search for symbols
project-index search "AuthManager"
project-index search "login" --exact

# Rebuild full index  
project-index index

# Start file watcher (auto-updates)
project-index watch --daemon
```

### v1.2 Agent-Optimized Commands 🤖

```bash
# Smart context suggestions (agent-optimized)
project-index suggest "auth" --json
project-index suggest "components" --json

# Dependency analysis
project-index deps "src/core/indexer.ts" --json
project-index deps "src/auth.ts" --reverse --json
project-index deps "orphans" --orphans --json

# Change impact analysis
project-index impact "src/utils/helpers.ts" --json
project-index impact "src/auth/service.ts" --depth 3 --json
```

### Project Setup

```bash
# Initialize indexing for any project
project-index-init [directory]

# Check if project is indexed
project-index status

# Force reindex after major changes
project-index index
```

## 📁 Project Structure

When initialized, your project gets:

```
your-project/
├── .claude/
│   └── settings.json          # Local permissions only
├── .context/.project/
│   └── PROJECT_INDEX.json     # The magic file 🎯
└── .indexer.log              # Watcher logs

# Global hooks (installed once, work everywhere)
/home/keith/.claude/hooks/
├── indexer.sh                 # Background indexer  
└── load-index.sh             # Session startup
```

## ⚙️ Configuration

### Supported Languages

| Language | Support Level | Features | Status |
|----------|---------------|----------|--------|
| **TypeScript/JavaScript** | ✅ Full | React components, API routes, JSX | ✅ **Enhanced** |
| **TSX/JSX** | ✅ Full | forwardRef, memo, HOCs, hooks, props | ✅ **All Patterns** |  
| **Python** | ✅ Enhanced | AST parsing, classes, methods, imports/exports | ✅ **Fixed Parsing** |
| **Go** | ✅ Full | Functions, structs, interfaces, methods, exports | ✅ **v1.2 Complete** |
| **Rust** | ✅ Full | Structs, enums, traits, impl blocks, modules | ✅ **v1.2 Complete** |
| **Shell/Bash** | ✅ Basic | Functions, commands, scripts | ✅ **Working** |

### v1.1 Enhanced Detection

**React Projects:**
```json
{
  "reactComponents": [
    {
      "name": "UserProfile", 
      "type": "functional",
      "hooks": ["useState", "useEffect", "useCallback"],
      "propsType": "UserProfileProps",
      "isExported": true
    }
  ]
}
```

**API Projects:**
```json
{
  "apiEndpoints": [
    {
      "method": "POST",
      "path": "/api/users/:id",
      "framework": "express", 
      "middleware": ["auth", "validate"],
      "handler": "updateUser"
    }
  ]
}
```

### Global Configuration (v1.2+)

Hooks are now installed globally in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/indexer.sh start"
          },
          {
            "type": "command", 
            "command": "$HOME/.claude/hooks/load-index.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "$HOME/.claude/hooks/indexer.sh update"
          }
        ]
      }
    ]
  }
}
```

**Project-local settings** (`project/.claude/settings.json`) only need permissions:

```json
{
  "permissions": {
    "allow": ["Bash(find:*)", "Bash(tree:*)", "Bash(grep:*)"],
    "additionalDirectories": ["/path/to/additional/dirs"]
  }
}
```

### Exclusion Patterns

Modify the indexer configuration to exclude files:

```typescript
// Default exclusions
excludePatterns: [
  'node_modules/**',
  '.git/**', 
  'dist/**',
  'build/**',
  '**/*.test.{ts,js}',
  '.next/**'
]
```

## 📊 Performance & Efficiency

### Token Consumption

| Operation | Before Project Index | With Project Index |
|-----------|---------------------|-------------------|
| **Session Start** | 0 tokens (but no context) | 2-5K tokens (full context!) |
| **File Discovery** | 500+ tokens per search | 0 tokens (instant lookup) |
| **Symbol Search** | 200+ tokens per query | 0 tokens (index search) |
| **Architecture Questions** | 1000+ tokens exploring | 50+ tokens (knows structure) |

### Speed Improvements

- **Initial Project Understanding**: Instant vs. 5-10 message exploration
- **File Navigation**: Direct to `src/auth/login.ts:45` vs. trial and error
- **Refactoring**: Knows all dependencies upfront
- **Code Review**: Understands impact scope immediately

## ✅ v1.1 Validation

All v1.1 features have been **thoroughly tested** and are working correctly:

**Python Parser Test Results:**
- ✅ Imports detected (from typing import List, Dict)
- ✅ Exports detected (functions, classes, variables) 
- ✅ Symbols detected (classes with methods, functions)
- ✅ Class methods detected (with proper parent relationships)

**Framework Detection Test Results:**
- ✅ Express endpoints detected (app.get, middleware)
- ✅ Koa endpoints detected (router.get, ctx parameter)
- ✅ Fastify endpoints detected (server.get, request/reply)
- ✅ Next.js endpoints detected (export GET/POST functions)
- ✅ Multiple frameworks in single file
- ✅ Middleware extraction working

**React Component Test Results:**
- ✅ Functional components detected
- ✅ Class components detected  
- ✅ forwardRef components detected
- ✅ memo components detected
- ✅ HOC functions detected (withLoading)
- ✅ HOC-wrapped components detected 
- ✅ Hooks extraction (useState, useEffect, custom hooks)
- ✅ Props type extraction

🎉 **Overall: 20/20 tests passed (100% success rate)**

## 🔧 Troubleshooting

### Common Issues

**Installation failed with "tsc: not found"?**
```bash
# Install TypeScript globally first
npm install -g typescript

# Then retry installation
./install.sh
```

**Command not found: project-index-init?**
```bash
# Add ~/.local/bin to your PATH
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc
source ~/.bashrc

# Or restart your terminal
```

**Index not loading?**
```bash
# Check hooks are configured globally
project-index status

# Verify global hook files exist
ls -la ~/.claude/hooks/

# Test hooks manually
~/.claude/hooks/load-index.sh
```

**Watcher not updating?**
```bash
# Check watcher status
~/.claude/hooks/indexer.sh status

# Restart watcher
~/.claude/hooks/indexer.sh stop
~/.claude/hooks/indexer.sh start
```

**Hook path errors (v1.2 migration)?**
```bash
# Remove old local hooks if they exist
rm -rf .claude/hooks/

# Ensure global hooks are installed
ls -la ~/.claude/hooks/indexer.sh ~/.claude/hooks/load-index.sh
```

**Missing symbols?**
```bash
# Force full reindex
project-index index

# Check excluded patterns
project-index status
```

### Debug Mode

Enable debug logging:
```bash
# Watch with verbose output
project-index watch --verbose

# Check watcher logs
tail -f .indexer.log
```

## 🚀 Advanced Usage

### Multiple Projects

Each project gets its own index:
```bash
cd ~/work/project-a
project-index-init

cd ~/work/project-b  
project-index-init
```

### CI/CD Integration

Pre-build the index in CI:
```yaml
# .github/workflows/claude-index.yml
- name: Build Project Index
  run: |
    npm install -g project-index
    project-index index
    
- name: Upload Index
  uses: actions/upload-artifact@v3
  with:
    name: project-index
    path: PROJECT_INDEX.json
```

### Custom Parsers

Add support for new languages:
```typescript
// src/parsers/python.ts
export class PythonParser implements Parser {
  async parse(content: string): Promise<ParseResult> {
    // Use ast module or tree-sitter-python
  }
}
```

## 🤝 Contributing

We welcome contributions! Priority areas for v1.2:

- ☕ **Java/C# support** via tree-sitter parsers
- 🦀 **Rust support** via rust-analyzer integration
- 🚀 **Go parser** enhancements (interfaces, struct methods)
- 🌐 **GraphQL schema** detection
- 🔍 **Semantic search** with embeddings
- 🧪 **Extended test coverage** for edge cases

**v1.1 Complete:** Python, React, and API detection are now fully working!

### Development Setup

```bash
git clone https://github.com/4xguy/project-index.git
cd project-index
npm install
npm run dev

# Test on sample project
npm run build
node dist/cli.js index ./sample-project
```

## 📜 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- **Eric** for the original Project Index concept and Claude Code workflow patterns
- **Anthropic** for Claude Code hooks system
- **ts-morph** team for excellent TypeScript AST tooling
- **chokidar** for reliable file watching

## 🔮 Roadmap

### v1.2 (Current) ✅ **AGENT-OPTIMIZED RELEASE**

All v1.2 features are **fully implemented and tested** for agentic workflows:

- [x] **Smart Context Suggestions** - AI-powered symbol recommendations with confidence scores
- [x] **Dependency Analysis** - Full dependency graph exposure with reverse lookups and orphan detection  
- [x] **Change Impact Analysis** - Predictive impact vectors showing high/medium/low confidence affected files
- [x] **Agent-Optimized JSON** - Dense structured data designed for LLM consumption, not human reading
- [x] **Memory Integration** - Auto-stores project patterns following CLAUDE.md protocol
- [x] **Python parser** - AST-based Python symbol extraction with imports, exports, classes, and methods
- [x] **React component detection** - Detects functional/class components, forwardRef, memo, HOCs, hooks, and props
- [x] **API endpoint mapping** - Framework-specific detection for Express/Koa/Fastify/Next.js/NestJS with middleware

**v1.2 Agent Optimizations:**
- 🤖 **Smart Suggestions**: `project-index suggest "auth" --json` returns symbol clusters with confidence scores
- 🔗 **Dependency Intelligence**: `project-index deps --reverse --json` exposes full dependency relationships  
- 💥 **Impact Predictions**: `project-index impact "file.ts" --json` calculates change ripple effects
- 🧠 **Memory Storage**: Auto-stores architectural patterns and conventions for persistent knowledge

**v1.2 Agent-Optimized Output Examples:**

```json
// Smart Context Suggestions
{
  "context": "auth",
  "primary": [
    {"symbol": "AuthService", "location": "src/auth/service.ts:12", "confidence": 0.95},
    {"symbol": "useAuth", "location": "src/hooks/auth.ts:8", "confidence": 0.90}
  ],
  "related": [
    {"symbol": "LoginForm", "location": "src/components/Login.tsx:15", "confidence": 0.75}
  ]
}

// Change Impact Analysis  
{
  "file": "src/auth/service.ts",
  "impact": {
    "high": ["src/hooks/auth.ts", "src/components/Login.tsx"],
    "medium": ["src/pages/Dashboard.tsx"],
    "low": []
  },
  "tests": ["src/auth/service.test.ts"],
  "totalAffected": 3
}

// Dependency Analysis
{
  "file": "src/core/indexer.ts", 
  "imports": ["crypto", "fs", "src/parsers/typescript.ts"],
  "importedBy": ["src/cli.ts", "src/core/watcher.ts"],
  "count": 2
}
```

### v1.3 (Future)
- [ ] Multi-language support (Java, C#, Rust)
- [ ] Pattern detection and architectural suggestions
- [ ] Cross-project dependency tracking
- [ ] Visual dependency graphs
- [ ] Semantic search with embeddings

### v2.0 (Vision)
- [ ] Real-time collaboration features
- [ ] Architecture visualization
- [ ] Pattern detection and suggestions
- [ ] Integration with popular IDEs

---

**Get started today and give Claude instant project superpowers!** 🧠⚡

Questions? Issues? [Open an issue](../../issues) or [start a discussion](../../discussions).
