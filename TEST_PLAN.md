# Project Index v1.1 Comprehensive Testing Plan

## 🎯 Testing Objectives

1. **Feature Validation**: Ensure all v1.1 features work as documented
2. **Edge Case Coverage**: Test complex scenarios and error conditions  
3. **Performance Testing**: Validate performance with realistic codebases
4. **Integration Testing**: Verify Claude Code integration works
5. **Regression Testing**: Ensure v1.0 features still work

## 📋 Test Categories

### 1. React Component Detection Tests

#### Basic Component Types
- [x] ~~Basic functional component~~ ✅
- [x] ~~Arrow function component~~ ✅  
- [x] ~~Class component with props~~ ✅
- [ ] ForwardRef components
- [ ] Memo/React.memo wrapped components
- [ ] Higher-order components (HOCs)
- [ ] Components with generic types

#### Hook Detection  
- [x] ~~useState, useEffect~~ ✅
- [ ] useCallback, useMemo, useRef
- [ ] useContext, useReducer  
- [ ] Custom hooks
- [ ] Hook dependencies and arrays
- [ ] Conditional hooks (should detect as hooks)

#### Props Analysis
- [x] ~~Interface props~~ ✅
- [ ] Type union props  
- [ ] Generic props
- [ ] Optional vs required props
- [ ] Default parameters
- [ ] Spread props

#### Complex Patterns
- [ ] Components with multiple export patterns
- [ ] Nested components (component inside component)
- [ ] Components with conditional rendering
- [ ] Components using React.Fragment
- [ ] JSX.Element vs ReactNode return types

### 2. API Endpoint Detection Tests

#### Framework Support
- [x] ~~Express basic routes~~ ✅
- [x] ~~Express with middleware~~ ✅
- [ ] Koa framework routes
- [ ] Fastify framework routes  
- [ ] Next.js API routes
- [ ] NestJS decorators

#### HTTP Methods
- [x] ~~GET, POST, PUT, DELETE, PATCH~~ ✅
- [ ] HEAD, OPTIONS
- [ ] Custom methods
- [ ] Route parameters (:id, :slug)
- [ ] Query parameters handling

#### Middleware Detection
- [x] ~~Single middleware~~ ✅
- [x] ~~Multiple middleware~~ ✅
- [ ] Middleware with configuration
- [ ] Conditional middleware
- [ ] Middleware arrays
- [ ] Anonymous middleware functions

#### Handler Types
- [x] ~~Arrow functions~~ ✅
- [x] ~~Named functions~~ ✅
- [ ] Class methods as handlers
- [ ] Async handlers
- [ ] Handler with error handling

### 3. Python Parser Tests

#### Basic Syntax
- [ ] Function definitions
- [ ] Class definitions  
- [ ] Import statements
- [ ] From imports
- [ ] Module exports

#### Advanced Python
- [ ] Decorators
- [ ] Type hints
- [ ] Async/await functions
- [ ] Class inheritance
- [ ] Magic methods (__init__, __str__)
- [ ] Property decorators

### 4. Integration & Performance Tests

#### File System Operations
- [ ] Large project indexing (100+ files)
- [ ] Incremental updates with file watcher
- [ ] Binary file handling (.png, .jpg, etc.)
- [ ] Symbolic links handling
- [ ] Deep directory structures

#### Error Handling
- [ ] Malformed TypeScript files  
- [ ] Syntax errors in React components
- [ ] Missing dependencies
- [ ] Permission denied scenarios
- [ ] Corrupted index recovery

#### Claude Code Integration
- [ ] Hook execution on session start
- [ ] Background watcher functionality
- [ ] Index loading in Claude context
- [ ] Token consumption measurement
- [ ] Multiple project switching

### 5. Schema & Output Validation

#### JSON Structure
- [ ] Schema version compatibility
- [ ] Required vs optional fields
- [ ] Data type validation
- [ ] Array vs object consistency

#### Symbol Indexing
- [ ] Correct line numbers
- [ ] Parent-child relationships
- [ ] Signature accuracy
- [ ] Docstring preservation

## 🔧 Test Implementation Strategy

### Phase 1: Unit Tests (Current)
1. Create test files for each feature area
2. Run indexer on test files
3. Validate JSON output structure
4. Check for parsing errors

### Phase 2: Integration Tests
1. Test with real-world project structures
2. Validate watcher functionality  
3. Test Claude Code hook integration
4. Performance benchmarking

### Phase 3: Edge Case & Error Testing
1. Malformed input handling
2. Large file scenarios
3. Network/filesystem edge cases
4. Recovery mechanisms

## 📊 Success Criteria

### Feature Completeness
- [ ] All documented v1.1 features working
- [ ] No regression in v1.0 functionality
- [ ] Comprehensive error handling
- [ ] Performance within acceptable limits

### Quality Gates
- [ ] Zero parsing errors on test suite
- [ ] 100% schema compliance
- [ ] < 5 second indexing for 100 file project
- [ ] < 50ms incremental updates

## 🚨 Known Issues to Address
1. Python parser symbol extraction appears broken
2. Need to verify all framework detection works
3. Complex React patterns not tested
4. No performance benchmarks established

## 📝 Test Execution Log

### Completed Tests
- [x] Basic React components (3/3 detected correctly)
- [x] Basic API endpoints (6/6 detected correctly)
- [x] Build system functionality
- [x] CLI basic operations

### Failed/Incomplete Tests
- [ ] Python symbol extraction (empty arrays returned)
- [ ] Advanced React patterns (not tested)
- [ ] Multiple framework support (only Express tested)
- [ ] Error handling scenarios (not tested)
- [ ] Performance with large codebases (not tested)

## 🎯 Next Steps
1. Execute Phase 1 unit tests systematically
2. Fix Python parser issues
3. Add comprehensive React pattern tests
4. Validate all framework detection
5. Implement error scenario testing