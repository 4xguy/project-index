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

**Result**: Claude understands your entire project from the first message, using only ~2-5K tokens regardless of project size.

## 📋 Requirements

- **Node.js** 16+ (for TypeScript compilation and runtime)
- **Git** (for cloning the repository)
- **TypeScript compiler** (automatically installed if missing)
- **Claude Code** with hooks support

## 🚀 Quick Start

### Global Installation (Recommended)

```bash
# Install globally
git clone <this-repo>
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
git clone <this-repo> .project-index
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
│   ├── settings.json          # Hook configuration
│   └── hooks/
│       ├── indexer.sh         # Background indexer
│       └── load-index.sh      # Session startup
├── .context/.project/
│   └── PROJECT_INDEX.json     # The magic file 🎯
└── .indexer.log              # Watcher logs
```

## ⚙️ Configuration

### Supported Languages

- ✅ **TypeScript/JavaScript** (Full support via ts-morph)
- ✅ **Python** (Basic support via AST) 
- ✅ **Go** (Basic support)
- ⏳ **Java, C#, Rust** (Coming soon)

### Customization

Edit your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/indexer.sh start"
          },
          {
            "type": "command", 
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/load-index.sh"
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
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/indexer.sh update"
          }
        ]
      }
    ]
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
# Check hooks are configured
project-index status

# Verify hook files exist
ls -la .claude/hooks/

# Test hooks manually
./.claude/hooks/load-index.sh
```

**Watcher not updating?**
```bash
# Check watcher status
./.claude/hooks/indexer.sh status

# Restart watcher
./.claude/hooks/indexer.sh stop
./.claude/hooks/indexer.sh start
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

We welcome contributions! Areas needing help:

- 🐍 **Python parser** improvements
- ☕ **Java/C# support** via tree-sitter
- 🦀 **Rust support** via rust-analyzer
- 📱 **React component** detection
- 🔗 **API route** mapping
- 🧪 **Test coverage** expansion

### Development Setup

```bash
git clone <this-repo>
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

### v1.1 (Next)
- [ ] NPM package publication
- [ ] Python parser improvements  
- [ ] React component detection
- [ ] API endpoint mapping

### v1.2 (Future)
- [ ] Multi-language support (Java, C#, Rust)
- [ ] Semantic search with embeddings
- [ ] Cross-project dependency tracking
- [ ] Visual dependency graphs

### v2.0 (Vision)
- [ ] Real-time collaboration features
- [ ] Architecture visualization
- [ ] Pattern detection and suggestions
- [ ] Integration with popular IDEs

---

**Get started today and give Claude instant project superpowers!** 🧠⚡

Questions? Issues? [Open an issue](../../issues) or [start a discussion](../../discussions).