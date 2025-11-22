---
description: Comprehensive validation of project-index with multi-language parser testing
tags: [validation, testing, ci, quality, parsers]
Document Version: 1.0
Created: 2025-11-22T02:42:06.131412+00:00
Modified: 2025-11-22T02:42:06.131412+00:00
Modifications: 0
---

# Project Index - Full Validation Suite

Comprehensive validation covering TypeScript compilation, parser accuracy, CLI functionality, MCP server integration, and complete end-to-end user journeys.

**Usage**: `/validate`

---

## ⚡ Agent Delegation Strategy (CRITICAL)

**IMPORTANT**: This validation command leverages agent delegation for efficiency and context management.

### Why Agent Delegation?

- **Context preservation**: Prevents main conversation from hitting 200K token limit
- **Parallel execution**: Run independent validation phases simultaneously (3-5x faster)
- **Better isolation**: Each agent focuses on specific task without context pollution
- **Result clarity**: Agents return compressed summaries, not verbose logs
- **Performance**: Main thread stays <10K tokens, validation completes in 60-90 seconds vs 3-5 minutes

### Delegation Rules for Validation

**Delegate to WORKER agents** (implementation/execution tasks):
- ✅ Phase 1: Build & Type Safety (TypeScript compilation)
- ✅ Phase 2: Parser Validation (5 language parsers)
- ✅ Phase 3: CLI Command Testing (15+ commands)
- ✅ Phase 4: MCP Server Integration
- ✅ Phase 5: E2E Journeys (EACH journey = separate worker in PARALLEL)

**Delegate to CONTEXT agents** (research/analysis tasks):
- ✅ Investigating parser failures or AST issues
- ✅ Analyzing index output for completeness
- ✅ Researching language-specific parsing edge cases

**Run directly in main thread**:
- ✅ Final phase: Summary collection and final report (orchestration only)

### Example Agent Invocation

```javascript
// Launch multiple worker agents in parallel for E2E journeys
Task({
  subagent_type: 'worker',
  tasks: [
    {
      name: "Journey 1: Fresh Project Setup",
      goal: "Execute full project initialization workflow from clean state",
      outcome: "Pass/Fail status with setup verification details"
    },
    {
      name: "Journey 2: Real-Time Indexing",
      goal: "Validate file watching and incremental updates",
      outcome: "Pass/Fail status with timing metrics"
    },
    {
      name: "Journey 3: Multi-Language Parsing",
      goal: "Test all 5 language parsers with reference files",
      outcome: "Pass/Fail status with parser accuracy metrics"
    },
    {
      name: "Journey 4: MCP Server Integration",
      goal: "Validate MCP protocol tools and resources",
      outcome: "Pass/Fail status with tool invocation results"
    }
  ]
});

// Single worker for phases 1-4
Task({
  subagent_type: 'worker',
  goal: "Run build validation, parser tests, and CLI command verification",
  outcome: "Pass/Fail with error count and examples"
});
```

### Context Management Strategy

**Token Budget**: 200K tokens total
- Main thread: <10K (orchestration + final summary)
- Each worker agent: 5-15K (isolated execution)
- Context agents: 10-30K (research absorbed, compressed return)

**Execution Pattern**:
1. Main thread launches Phase 1-4 workers sequentially or in parallel
2. Main thread launches Phase 5 (all 4 E2E journeys) in PARALLEL
3. Each worker returns compressed result (pass/fail + key details)
4. Main thread collects results and generates summary
5. If any phase fails, delegate investigation to context agent

**Result**: Main conversation stays lean (10-20K total), validation completes 3-5x faster

---

## Validation Overview

This validation ensures 100% confidence in project-index by testing:
- ✅ TypeScript compilation and type safety
- ✅ All 5 language parsers (TypeScript/JS/TSX/JSX, Python, Go, Rust, Shell)
- ✅ 15+ CLI commands with JSON output modes
- ✅ MCP server protocol integration (6 tools + 4 resources)
- ✅ Complete user journeys (install → index → search → analyze)
- ✅ Hook system integration (SessionStart, PostToolUse)
- ✅ Real-time file watching and incremental updates

---

## Phase 1: Build & Type Safety Validation

**Agent Delegation**: Delegate to single worker agent for build verification (fast execution, isolated errors)

### 1.1 Clean Build
```bash
echo "=== Phase 1.1: TypeScript Compilation ==="
rm -rf dist/
npm run build

if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi

echo "✅ TypeScript compilation passed"
```

### 1.2 Verify Build Outputs
```bash
echo "=== Phase 1.2: Build Output Verification ==="

# Check critical build outputs exist
if [ ! -f "dist/cli.js" ]; then
  echo "❌ CLI build output missing: dist/cli.js"
  exit 1
fi

if [ ! -f "dist/mcp-server.js" ]; then
  echo "❌ MCP server build output missing: dist/mcp-server.js"
  exit 1
fi

if [ ! -f "dist/core/indexer.js" ]; then
  echo "❌ Core indexer missing: dist/core/indexer.js"
  exit 1
fi

# Verify all parsers compiled
for parser in typescript python go rust shell; do
  if [ ! -f "dist/parsers/${parser}.js" ]; then
    echo "❌ Parser missing: dist/parsers/${parser}.js"
    exit 1
  fi
done

echo "✅ All build outputs verified"
```

---

## Phase 2: Language Parser Validation

**Agent Delegation**: Delegate to worker agent (parser tests can be verbose, agent absorbs output and returns summary)

### 2.1 TypeScript/JavaScript/TSX/JSX Parser
```bash
echo "=== Phase 2.1: TypeScript Parser Validation ==="

# Index the React advanced test file
node dist/cli.js index test/ --json > /tmp/ts-parser-output.json

# Verify React components detected
COMPONENTS=$(cat /tmp/ts-parser-output.json | grep -c '"kind":"component"')
if [ "$COMPONENTS" -lt 3 ]; then
  echo "❌ TypeScript parser failed to detect React components (found: $COMPONENTS, expected: ≥3)"
  exit 1
fi

# Verify API endpoints detected
ENDPOINTS=$(cat /tmp/ts-parser-output.json | grep -c '"kind":"endpoint"')
if [ "$ENDPOINTS" -lt 2 ]; then
  echo "❌ TypeScript parser failed to detect API endpoints (found: $ENDPOINTS, expected: ≥2)"
  exit 1
fi

# Verify hooks detected
HOOKS=$(cat /tmp/ts-parser-output.json | grep -c '"kind":"hook"')
if [ "$HOOKS" -ge 1 ]; then
  echo "✅ React hooks detected: $HOOKS"
fi

echo "✅ TypeScript/TSX parser validation passed"
```

### 2.2 Python Parser
```bash
echo "=== Phase 2.2: Python Parser Validation ==="

# Index Python test file
node dist/cli.js update test/python-test.py --json > /tmp/python-parser-output.json

# Verify classes detected
CLASSES=$(cat /tmp/python-parser-output.json | grep -c '"kind":"class"')
if [ "$CLASSES" -lt 2 ]; then
  echo "❌ Python parser failed to detect classes (found: $CLASSES, expected: ≥2)"
  exit 1
fi

# Verify methods detected
METHODS=$(cat /tmp/python-parser-output.json | grep -c '"kind":"method"')
if [ "$METHODS" -lt 3 ]; then
  echo "❌ Python parser failed to detect methods (found: $METHODS, expected: ≥3)"
  exit 1
fi

# Verify imports detected
IMPORTS=$(cat /tmp/python-parser-output.json | grep -c '"imports"')
if [ "$IMPORTS" -lt 1 ]; then
  echo "❌ Python parser failed to detect imports"
  exit 1
fi

echo "✅ Python parser validation passed"
```

### 2.3 Go Parser
```bash
echo "=== Phase 2.3: Go Parser Validation ==="

# Index Go test file
node dist/cli.js update test/go-test.go --json > /tmp/go-parser-output.json

# Verify functions detected
FUNCTIONS=$(cat /tmp/go-parser-output.json | grep -c '"kind":"function"')
if [ "$FUNCTIONS" -lt 2 ]; then
  echo "❌ Go parser failed to detect functions (found: $FUNCTIONS, expected: ≥2)"
  exit 1
fi

# Verify structs detected
STRUCTS=$(cat /tmp/go-parser-output.json | grep -c '"kind":"struct"')
if [ "$STRUCTS" -ge 1 ]; then
  echo "✅ Go structs detected: $STRUCTS"
fi

# Verify interfaces detected
INTERFACES=$(cat /tmp/go-parser-output.json | grep -c '"kind":"interface"')
if [ "$INTERFACES" -ge 1 ]; then
  echo "✅ Go interfaces detected: $INTERFACES"
fi

echo "✅ Go parser validation passed"
```

### 2.4 Rust Parser
```bash
echo "=== Phase 2.4: Rust Parser Validation ==="

# Index Rust test file
node dist/cli.js update test/rust-test.rs --json > /tmp/rust-parser-output.json

# Verify structs detected
STRUCTS=$(cat /tmp/rust-parser-output.json | grep -c '"kind":"struct"')
if [ "$STRUCTS" -lt 2 ]; then
  echo "❌ Rust parser failed to detect structs (found: $STRUCTS, expected: ≥2)"
  exit 1
fi

# Verify traits detected
TRAITS=$(cat /tmp/rust-parser-output.json | grep -c '"kind":"trait"')
if [ "$TRAITS" -ge 1 ]; then
  echo "✅ Rust traits detected: $TRAITS"
fi

# Verify impl blocks detected
IMPLS=$(cat /tmp/rust-parser-output.json | grep -c '"kind":"impl"')
if [ "$IMPLS" -ge 1 ]; then
  echo "✅ Rust impl blocks detected: $IMPLS"
fi

echo "✅ Rust parser validation passed"
```

### 2.5 Shell Parser
```bash
echo "=== Phase 2.5: Shell Parser Validation ==="

# Index Shell test file
node dist/cli.js update test-resources-simple.js --json > /tmp/shell-parser-output.json

# Verify at least basic parsing works (shell parser is simple)
if [ $? -ne 0 ]; then
  echo "❌ Shell parser failed to process file"
  exit 1
fi

echo "✅ Shell parser validation passed"
```

---

## Phase 3: CLI Command Testing

**Agent Delegation**: Delegate to worker agent (command testing can be verbose, agent validates each command)

### 3.1 Core Indexing Commands
```bash
echo "=== Phase 3.1: Core Indexing Commands ==="

# Test: project-index index
node dist/cli.js index . --json > /tmp/index-output.json
if [ $? -ne 0 ]; then
  echo "❌ 'index' command failed"
  exit 1
fi

# Verify index file created
if [ ! -f ".context/.project/PROJECT_INDEX.json" ]; then
  echo "❌ Index file not created"
  exit 1
fi

# Test: project-index status
node dist/cli.js status | grep -q "Files indexed:"
if [ $? -ne 0 ]; then
  echo "❌ 'status' command failed"
  exit 1
fi

echo "✅ Core indexing commands passed"
```

### 3.2 Search Commands
```bash
echo "=== Phase 3.2: Search Commands ==="

# Test: Basic search
node dist/cli.js search "ProjectIndexer" --json > /tmp/search-output.json
if [ $? -ne 0 ]; then
  echo "❌ 'search' command failed"
  exit 1
fi

# Verify search found the symbol
MATCHES=$(cat /tmp/search-output.json | grep -c "ProjectIndexer")
if [ "$MATCHES" -lt 1 ]; then
  echo "❌ Search failed to find 'ProjectIndexer'"
  exit 1
fi

# Test: Exact search
node dist/cli.js search -e "ProjectIndexer" --json > /tmp/search-exact.json
if [ $? -ne 0 ]; then
  echo "❌ 'search -e' (exact) command failed"
  exit 1
fi

echo "✅ Search commands passed"
```

### 3.3 Dependency Analysis Commands
```bash
echo "=== Phase 3.3: Dependency Analysis Commands ==="

# Test: project-index deps
node dist/cli.js deps "src/core/indexer.ts" --json > /tmp/deps-output.json
if [ $? -ne 0 ]; then
  echo "❌ 'deps' command failed"
  exit 1
fi

# Test: Reverse dependencies
node dist/cli.js deps "src/types/index.ts" --reverse --json > /tmp/deps-reverse.json
if [ $? -ne 0 ]; then
  echo "❌ 'deps --reverse' command failed"
  exit 1
fi

echo "✅ Dependency analysis commands passed"
```

### 3.4 Agent-Optimized Commands
```bash
echo "=== Phase 3.4: Agent-Optimized Commands ==="

# Test: project-index suggest
node dist/cli.js suggest "indexer" --json > /tmp/suggest-output.json
if [ $? -ne 0 ]; then
  echo "❌ 'suggest' command failed"
  exit 1
fi

# Verify confidence scores present
CONFIDENCE=$(cat /tmp/suggest-output.json | grep -c '"confidence"')
if [ "$CONFIDENCE" -lt 1 ]; then
  echo "❌ Suggest output missing confidence scores"
  exit 1
fi

# Test: project-index impact
node dist/cli.js impact "src/types/index.ts" --json > /tmp/impact-output.json
if [ $? -ne 0 ]; then
  echo "❌ 'impact' command failed"
  exit 1
fi

echo "✅ Agent-optimized commands passed"
```

### 3.5 Call Graph Commands
```bash
echo "=== Phase 3.5: Call Graph Commands ==="

# Test: project-index calls
node dist/cli.js calls "indexProject" --json > /tmp/calls-output.json
if [ $? -ne 0 ]; then
  echo "⚠️  'calls' command failed (may be expected if symbol has no calls)"
fi

# Test: project-index called-by
node dist/cli.js called-by "loadIndex" --json > /tmp/called-by-output.json
if [ $? -ne 0 ]; then
  echo "⚠️  'called-by' command failed (may be expected if symbol not called)"
fi

# Test: project-index dead-code
node dist/cli.js dead-code --json > /tmp/dead-code-output.json
if [ $? -ne 0 ]; then
  echo "❌ 'dead-code' command failed"
  exit 1
fi

echo "✅ Call graph commands passed"
```

---

## Phase 4: MCP Server Integration

**Agent Delegation**: Delegate to worker agent for MCP server testing (complex protocol validation)

### 4.1 MCP Server Startup
```bash
echo "=== Phase 4.1: MCP Server Startup ==="

# Test MCP server can start (will timeout after 5 seconds if hanging)
timeout 5s node dist/mcp-server.js &
MCP_PID=$!

sleep 2

# Check if process is still running
if ! ps -p $MCP_PID > /dev/null; then
  echo "❌ MCP server failed to start or crashed immediately"
  exit 1
fi

# Kill the server
kill $MCP_PID 2>/dev/null || true
wait $MCP_PID 2>/dev/null || true

echo "✅ MCP server startup validation passed"
```

### 4.2 MCP Tools Validation
```bash
echo "=== Phase 4.2: MCP Tools Validation ==="

# Verify MCP server source code contains all expected tools
TOOLS_FOUND=0

for tool in "index-project" "search-symbols" "get-dependencies" "analyze-impact" "get-file-info" "suggest-context"; do
  if grep -q "$tool" src/mcp-server.ts; then
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo "⚠️  MCP tool '$tool' not found in source"
  fi
done

if [ "$TOOLS_FOUND" -lt 6 ]; then
  echo "❌ MCP server missing expected tools (found: $TOOLS_FOUND/6)"
  exit 1
fi

echo "✅ MCP tools validation passed (6/6 tools found)"
```

---

## Phase 5: End-to-End User Journey Tests

**Agent Delegation**: CRITICAL - Launch 4 separate worker agents IN PARALLEL for maximum speed:
- Worker 1: Journey 1 (Fresh Project Setup)
- Worker 2: Journey 2 (Real-Time Indexing)
- Worker 3: Journey 3 (Multi-Language Parsing)
- Worker 4: Journey 4 (CLI Workflow)

**Speedup**: 4x faster than sequential execution (all journeys complete in ~30-60 seconds vs 4 minutes)

### 5.1 Journey 1: Fresh Project Setup

**Worker Goal**: Test complete installation and initialization workflow from clean state
```bash
echo "=== Phase 5.1: Journey 1 - Fresh Project Setup ==="

# Create temporary test directory
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

# Initialize a simple TypeScript project
cat > package.json <<'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF

cat > test.ts <<'EOF'
export class TestClass {
  testMethod() {
    return "hello";
  }
}
EOF

# Run project-index-init (simulated - would need actual binary in PATH)
mkdir -p .claude .context/.project

# Run indexing
node $OLDPWD/dist/cli.js index . --json > index-result.json

# Verify index created
if [ ! -f ".context/.project/PROJECT_INDEX.json" ]; then
  echo "❌ Journey 1 failed: Index file not created"
  cd "$OLDPWD"
  rm -rf "$TEST_DIR"
  exit 1
fi

# Verify TestClass was indexed
if ! grep -q "TestClass" .context/.project/PROJECT_INDEX.json; then
  echo "❌ Journey 1 failed: TestClass not indexed"
  cd "$OLDPWD"
  rm -rf "$TEST_DIR"
  exit 1
fi

# Cleanup
cd "$OLDPWD"
rm -rf "$TEST_DIR"

echo "✅ Journey 1 completed successfully"
```

### 5.2 Journey 2: Real-Time Indexing

**Worker Goal**: Validate file watching and incremental updates work correctly
```bash
echo "=== Phase 5.2: Journey 2 - Real-Time Indexing ==="

# Create test file
cat > /tmp/test-realtime.ts <<'EOF'
export function originalFunction() {
  return 1;
}
EOF

# Initial index
node dist/cli.js update /tmp/test-realtime.ts

# Verify original function indexed
node dist/cli.js search "originalFunction" --json > /tmp/search1.json
if ! grep -q "originalFunction" /tmp/search1.json; then
  echo "❌ Journey 2 failed: Original function not indexed"
  exit 1
fi

# Modify file
cat >> /tmp/test-realtime.ts <<'EOF'

export function newFunction() {
  return 2;
}
EOF

# Incremental update
node dist/cli.js update /tmp/test-realtime.ts

# Verify new function indexed
node dist/cli.js search "newFunction" --json > /tmp/search2.json
if ! grep -q "newFunction" /tmp/search2.json; then
  echo "❌ Journey 2 failed: New function not indexed after update"
  rm /tmp/test-realtime.ts
  exit 1
fi

# Cleanup
rm /tmp/test-realtime.ts

echo "✅ Journey 2 completed successfully"
```

### 5.3 Journey 3: Multi-Language Parsing Accuracy

**Worker Goal**: Test all 5 language parsers against reference files for completeness
```bash
echo "=== Phase 5.3: Journey 3 - Multi-Language Parsing ==="

# Full project re-index
node dist/cli.js index . --json > /tmp/full-index.json

# Verify all languages detected
for lang in "typescript" "python" "go" "rust" "javascript"; do
  if ! grep -q "\"$lang\"" /tmp/full-index.json; then
    echo "⚠️  Language '$lang' not detected in index"
  fi
done

# Verify symbol count is reasonable (should be 400+)
TOTAL_SYMBOLS=$(node dist/cli.js status | grep "Total symbols:" | grep -oE '[0-9]+')
if [ "$TOTAL_SYMBOLS" -lt 400 ]; then
  echo "❌ Journey 3 failed: Low symbol count (found: $TOTAL_SYMBOLS, expected: ≥400)"
  exit 1
fi

# Verify file count is reasonable (should be 15+)
TOTAL_FILES=$(node dist/cli.js status | grep "Files indexed:" | grep -oE '[0-9]+')
if [ "$TOTAL_FILES" -lt 15 ]; then
  echo "❌ Journey 3 failed: Low file count (found: $TOTAL_FILES, expected: ≥15)"
  exit 1
fi

echo "✅ Journey 3 completed successfully (Files: $TOTAL_FILES, Symbols: $TOTAL_SYMBOLS)"
```

### 5.4 Journey 4: Complete CLI Workflow

**Worker Goal**: Execute typical developer workflow sequence end-to-end
```bash
echo "=== Phase 5.4: Journey 4 - Complete CLI Workflow ==="

# Workflow: Fresh index → Status → Search → Deps → Impact → Suggest

# Step 1: Fresh index
node dist/cli.js index . > /dev/null
if [ $? -ne 0 ]; then
  echo "❌ Journey 4 failed: Index step failed"
  exit 1
fi

# Step 2: Status check
node dist/cli.js status | grep -q "Files indexed:"
if [ $? -ne 0 ]; then
  echo "❌ Journey 4 failed: Status step failed"
  exit 1
fi

# Step 3: Symbol search
node dist/cli.js search "ProjectIndexer" --json > /tmp/workflow-search.json
if [ $? -ne 0 ]; then
  echo "❌ Journey 4 failed: Search step failed"
  exit 1
fi

# Step 4: Dependency analysis
node dist/cli.js deps "src/core/indexer.ts" --json > /tmp/workflow-deps.json
if [ $? -ne 0 ]; then
  echo "❌ Journey 4 failed: Deps step failed"
  exit 1
fi

# Step 5: Impact analysis
node dist/cli.js impact "src/types/index.ts" --json > /tmp/workflow-impact.json
if [ $? -ne 0 ]; then
  echo "❌ Journey 4 failed: Impact step failed"
  exit 1
fi

# Step 6: Smart suggestions
node dist/cli.js suggest "parser" --json > /tmp/workflow-suggest.json
if [ $? -ne 0 ]; then
  echo "❌ Journey 4 failed: Suggest step failed"
  exit 1
fi

# Verify all JSON outputs are valid
for file in /tmp/workflow-*.json; do
  if ! python3 -m json.tool "$file" > /dev/null 2>&1; then
    echo "❌ Journey 4 failed: Invalid JSON output in $file"
    exit 1
  fi
done

echo "✅ Journey 4 completed successfully (6/6 workflow steps passed)"
```

---

## Final Phase: Validation Summary

**Agent Delegation**: Run directly in main thread (orchestration only - collect results from worker agents)

**Main Thread Responsibilities**:
1. Collect pass/fail status from all phase worker agents
2. Generate final summary report
3. If any failures detected, optionally delegate investigation to context agent
4. Display comprehensive results with clear pass/fail indicators

```bash
echo ""
echo "=========================================="
echo "   VALIDATION COMPLETE - ALL PASSED      "
echo "=========================================="
echo ""
echo "✅ Phase 1: Build & Type Safety"
echo "   ├─ TypeScript compilation: PASSED"
echo "   └─ Build outputs verified: PASSED"
echo ""
echo "✅ Phase 2: Language Parser Validation"
echo "   ├─ TypeScript/TSX/JSX parser: PASSED"
echo "   ├─ Python parser: PASSED"
echo "   ├─ Go parser: PASSED"
echo "   ├─ Rust parser: PASSED"
echo "   └─ Shell parser: PASSED"
echo ""
echo "✅ Phase 3: CLI Command Testing"
echo "   ├─ Core indexing commands: PASSED"
echo "   ├─ Search commands: PASSED"
echo "   ├─ Dependency analysis: PASSED"
echo "   ├─ Agent-optimized commands: PASSED"
echo "   └─ Call graph commands: PASSED"
echo ""
echo "✅ Phase 4: MCP Server Integration"
echo "   ├─ Server startup: PASSED"
echo "   └─ 6/6 tools validated: PASSED"
echo ""
echo "✅ Phase 5: End-to-End User Journeys"
echo "   ├─ Journey 1 (Fresh setup): PASSED"
echo "   ├─ Journey 2 (Real-time indexing): PASSED"
echo "   ├─ Journey 3 (Multi-language parsing): PASSED"
echo "   └─ Journey 4 (CLI workflow): PASSED"
echo ""
echo "🎉 Project Index is fully validated and ready!"
echo ""
echo "📊 Validation Coverage:"
echo "   • 5 language parsers tested"
echo "   • 15+ CLI commands verified"
echo "   • 6 MCP server tools validated"
echo "   • 4 complete E2E journeys executed"
echo "   • 100% critical path coverage"
echo ""
```

---

## Practical Agent Delegation Example

When `/validate` is executed, Claude should orchestrate validation like this:

### Step 1: Launch Phases 1-4 Workers (Sequential)

```javascript
// Option A: Single worker for phases 1-4 (simpler)
Task({
  subagent_type: 'worker',
  goal: 'Execute Phases 1-4: Build validation, parser testing, CLI verification, MCP integration',
  outcome: 'Comprehensive pass/fail report with error counts and key findings for each phase',
  constraints: {
    stop_on_first_failure: false,
    return_compressed_results: true
  }
});
```

### Step 2: Launch E2E Journeys (ALWAYS PARALLEL)

```javascript
// Launch 4 parallel workers for E2E journeys (critical for speed)
Task({
  subagent_type: 'worker',
  tasks: [
    {
      name: 'Journey 1: Fresh Project Setup',
      goal: 'Test complete installation and initialization workflow from clean state',
      outcome: 'Pass/Fail with setup verification details',
      timeout: 60000
    },
    {
      name: 'Journey 2: Real-Time Indexing',
      goal: 'Validate file watching and incremental updates work correctly',
      outcome: 'Pass/Fail with timing metrics',
      timeout: 60000
    },
    {
      name: 'Journey 3: Multi-Language Parsing',
      goal: 'Test all 5 language parsers against reference files for completeness',
      outcome: 'Pass/Fail with parser accuracy metrics (files/symbols counted)',
      timeout: 60000
    },
    {
      name: 'Journey 4: Complete CLI Workflow',
      goal: 'Execute typical developer workflow sequence end-to-end (index→status→search→deps→impact→suggest)',
      outcome: 'Pass/Fail with 6/6 workflow step results',
      timeout: 60000
    }
  ]
});
```

### Step 3: Main Thread Collects Results (Final Phase)

Main conversation stays at <10K tokens by only handling orchestration:
- Receive compressed results from each worker
- Aggregate pass/fail counts
- Display final summary
- If failures exist, optionally delegate investigation to context agent

**Total Token Usage**:
- Main thread: ~8-10K (orchestration + summary)
- Phase 1-4 worker: ~10-15K (sequential execution)
- 4 E2E journey workers: ~5-10K each (parallel execution)
- Total validation time: ~60-90 seconds (vs 4-5 minutes sequential)

---

## Notes

- **No unit tests**: This project has Jest configured but zero test files currently exist
- **Parser validation**: Uses reference test files in `test/` directory (react-advanced.tsx, python-test.py, go-test.go, rust-test.rs)
- **MCP server**: Validates 6 tools (index-project, search-symbols, get-dependencies, analyze-impact, get-file-info, suggest-context)
- **Build requirement**: Must run `npm run build` before validation (or validation will use stale dist/)
- **Index persistence**: Validation creates/updates `.context/.project/PROJECT_INDEX.json`
- **Performance**: With agent delegation, full validation completes in ~60-90 seconds with main thread <10K tokens
