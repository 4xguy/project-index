# Changelog

All notable changes to the Project Index system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-08-13

### 🎉 Major Features Added

#### React Component Detection
- **Functional Components**: Automatically detects arrow functions and regular functions returning JSX
- **Class Components**: Identifies React.Component and React.PureComponent extensions  
- **Hook Analysis**: Extracts all hook usage including useState, useEffect, custom hooks
- **Props Extraction**: Captures prop interfaces and TypeScript type definitions
- **Export Tracking**: Determines which components are exported vs internal

Example output:
```json
"reactComponents": [
  {
    "name": "UserProfile",
    "type": "functional", 
    "line": 23,
    "propsType": "UserProfileProps",
    "hooks": ["useState", "useEffect", "useCallback"],
    "isExported": true
  }
]
```

#### API Endpoint Mapping
- **Express Routes**: Detects app.get, app.post, app.put, app.delete, app.patch calls
- **Middleware Extraction**: Captures middleware functions between path and handler
- **Multi-Framework Support**: Identifies Express, Koa, Fastify, Next.js, NestJS patterns
- **Handler Analysis**: Determines handler type (arrow function, named function, etc.)

Example output:
```json
"apiEndpoints": [
  {
    "method": "POST", 
    "path": "/api/users/:id",
    "handler": "updateUserHandler",
    "line": 45,
    "framework": "express",
    "middleware": ["authenticate", "validate"]
  }
]
```

#### Python AST Parser
- **Complete AST Parsing**: Uses pyparser library for comprehensive Python analysis
- **Import/Export Detection**: Tracks Python imports, from imports, and module exports
- **Symbol Extraction**: Functions, classes, methods with full signatures
- **Docstring Support**: Captures and preserves Python docstrings

### 🔧 Enhanced Type System
- Added `ComponentInfo` interface for React component metadata
- Added `ApiEndpointInfo` interface for API endpoint details
- Extended `SymbolKind` enum with new symbol types:
  - `Component`, `Hook`, `PropsInterface` for React
  - `ApiEndpoint`, `ApiRoute` for API detection
- Enhanced `FileInfo` with optional `reactComponents` and `apiEndpoints` arrays
- Updated `ParseResult` to include React and API detection results

### 📦 NPM Package Preparation  
- Configured package.json for npm publication with proper metadata
- Created .npmignore to exclude development files from package
- Added repository, homepage, and bug tracker links
- Set up TypeScript declarations and proper entry points
- Added prepublishOnly script for automated builds

### 🛠️ Infrastructure Improvements
- Enhanced TypeScript parser with comprehensive JSX/TSX detection
- Added framework detection logic for multiple API libraries
- Improved AST traversal using SyntaxKind-based detection patterns
- Added sophisticated middleware and handler analysis
- Extended core indexer to handle new parser capabilities

### 📋 Testing & Validation
- Validated React component detection with functional and class components
- Tested API endpoint detection with Express middleware patterns  
- Verified hook extraction across useState, useEffect, and custom hooks
- Confirmed framework detection for Express, Koa, Fastify patterns
- Ensured proper JSON schema compliance for new features

### 🐛 Improvements
- Fixed Python parser TypeScript integration issues
- Improved error handling for malformed JSX components
- Enhanced framework detection accuracy
- Better handling of arrow functions vs regular functions

## [1.0.0] - 2025-08-13

### Added
- **Core Indexing System**: AST-based indexing using ts-morph for TypeScript/JavaScript projects
- **Token-free Operation**: 95% of indexing operations use deterministic parsing without AI tokens
- **Incremental Updates**: Real-time file watching with chokidar for automatic index updates
- **Claude Code Integration**: Seamless hooks integration for automatic session startup
- **Global Installation**: Install once, use everywhere with `project-index-init`
- **Smart Project Overview**: Intelligent project summary instead of raw JSON dump
- **Automatic TypeScript Installation**: Install script handles TypeScript compiler dependency
- **Flexible Binary Detection**: Hooks work with both global and local installations

### Features
- **File Discovery**: Automatic discovery of TypeScript/JavaScript files
- **Symbol Extraction**: Complete symbol mapping with location information
- **Dependency Analysis**: Import/export relationship mapping
- **Function Signatures**: Type-aware signature extraction with documentation
- **Project Structure**: Directory-based file organization analysis
- **Change Detection**: Hash-based file change detection for efficient updates
- **Error Handling**: Graceful degradation and comprehensive error reporting

### Installation
- **Global Setup**: `./install.sh` for system-wide installation
- **Project Init**: `project-index-init` for per-project setup
- **PATH Management**: Automatic PATH configuration for command availability

### Claude Code Integration
- **Session Hooks**: Automatic index loading on Claude Code startup
- **File Watching**: Background process for real-time index updates
- **Hook Scripts**: Smart binary detection (global vs local)
- **Context Loading**: ~150 tokens vs 12,000+ tokens for equivalent information

### Configuration
- **Index Location**: `.context/.project/PROJECT_INDEX.json` for clean organization
- **Hook Configuration**: `.claude/settings.json` with SessionStart and PostToolUse hooks
- **Watcher Management**: Automatic daemon process management with PID tracking

### Architecture
- **Schema Version**: 1.0.0 with forward compatibility design
- **Timestamp Management**: Proper `createdAt` preservation during updates
- **Directory Structure**: Organized file layout with `.context/.project/` convention
- **Build System**: TypeScript compilation with npm scripts

### Documentation
- **Comprehensive README**: Installation, usage, and troubleshooting guide
- **Command Reference**: Complete CLI documentation with examples
- **Hook Documentation**: Integration guide for Claude Code workflows
- **Requirements**: Node.js, Git, TypeScript compiler specifications

### Quality Assurance
- **Error Recovery**: Robust error handling and graceful fallbacks
- **Performance**: Optimized for projects with hundreds of files
- **Testing**: Verified across multiple project structures and sizes
- **Debugging**: Comprehensive logging and status reporting

### Known Limitations
- Currently supports TypeScript/JavaScript projects only
- Requires Node.js 16+ for TypeScript compilation
- File watcher performance may vary on very large projects (500+ files)

### Future Roadmap
- Multi-language support (Python, Go, Java, etc.)
- MCP server wrapper for enhanced Claude integration
- Advanced compression techniques for large projects
- Plugin system for custom parsers and analyzers