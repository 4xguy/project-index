import * as pyparser from 'pyparser';
import { 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  SymbolInfo, 
  OutlineSection,
  SymbolKind 
} from '../types';

interface PythonASTNode {
  type?: string;
  kind?: string;
  lineno?: number;
  col_offset?: number;
  name?: string;
  id?: string;
  module?: string;
  names?: Array<{ name: string; asname?: string }>;
  body?: PythonASTNode[];
  args?: { args: Array<{ arg: string; annotation?: any }> };
  returns?: any;
  bases?: PythonASTNode[];
  decorator_list?: PythonASTNode[];
  value?: PythonASTNode;
  targets?: PythonASTNode[];
  [key: string]: any; // Allow additional properties from pyparser
}

export class PythonParser {
  async parse(content: string, filePath: string): Promise<ParseResult> {
    try {
      const ast = await pyparser.parse(content) as any;
      return {
        imports: this.extractImports(ast),
        exports: this.extractExports(ast),
        symbols: this.extractSymbols(ast),
        outline: this.extractOutline(ast)
      };
    } catch (error) {
      console.warn(`Failed to parse Python file ${filePath}:`, error);
      return {
        imports: [],
        exports: [],
        symbols: [],
        outline: []
      };
    }
  }

  private extractImports(ast: any): ImportInfo[] {
    const imports: ImportInfo[] = [];
    this.walkAST(ast, (node) => {
      const nodeType = node._type || node.type || node.kind || '';
      if (nodeType === 'Import') {
        // import module1, module2 as alias
        node.names?.forEach((nameNode: any) => {
          imports.push({
            module: nameNode.name,
            alias: nameNode.asname,
            symbols: [nameNode.asname || nameNode.name]
          });
        });
      } else if (nodeType === 'ImportFrom') {
        // from module import name1, name2
        const moduleValue = node.module || '';
        const symbols = node.names?.map((n: any) => n.asname || n.name) || [];
        imports.push({
          module: moduleValue,
          symbols: symbols
        });
      }
    });
    return imports;
  }

  private extractExports(ast: any): ExportInfo[] {
    const exports: ExportInfo[] = [];
    
    this.walkAST(ast, (node) => {
      const nodeType = node._type || node.type || node.kind || '';
      if (nodeType === 'FunctionDef' || nodeType === 'AsyncFunctionDef') {
        // Functions are exportable if not prefixed with underscore
        if (!node.name?.startsWith('_')) {
          exports.push({
            name: node.name || 'unknown',
            type: 'function',
            line: node.lineno || 0,
            signature: this.buildFunctionSignature(node)
          });
        }
      } else if (nodeType === 'ClassDef') {
        // Classes are exportable if not prefixed with underscore
        if (!node.name?.startsWith('_')) {
          exports.push({
            name: node.name || 'unknown',
            type: 'class',
            line: node.lineno || 0,
            signature: `class ${node.name}`
          });
        }
      } else if (nodeType === 'Assign') {
        // Global variable assignments
        if (node.targets && node.targets.length > 0) {
          const target = node.targets[0];
          const targetType = target._type || target.type || target.kind || '';
          if (targetType === 'Name' && target.id && !target.id.startsWith('_')) {
            exports.push({
              name: target.id,
              type: 'const',
              line: node.lineno || 0
            });
          }
        }
      }
    });

    return exports;
  }

  private extractSymbols(ast: any): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    
    this.walkAST(ast, (node) => {
      const nodeType = node._type || node.type || node.kind || '';
      if (nodeType === 'FunctionDef' || nodeType === 'AsyncFunctionDef') {
        const calls = this.extractCalls(node);
        symbols.push({
          name: node.name || 'unknown',
          kind: SymbolKind.Function,
          line: node.lineno || 0,
          column: node.col_offset || 0,
          signature: this.buildFunctionSignature(node),
          docstring: this.extractDocstring(node),
          calls: calls
        });
      } else if (nodeType === 'ClassDef') {
        const classSymbol: SymbolInfo = {
          name: node.name || 'unknown',
          kind: SymbolKind.Class,
          line: node.lineno || 0,
          column: node.col_offset || 0,
          signature: `class ${node.name}`,
          docstring: this.extractDocstring(node),
          children: []
        };

        // Extract class methods
        if (node.body) {
          node.body.forEach((bodyNode: any) => {
            const bodyNodeType = bodyNode._type || bodyNode.type || bodyNode.kind || '';
            if (bodyNodeType === 'FunctionDef' || bodyNodeType === 'AsyncFunctionDef') {
              const methodCalls = this.extractCalls(bodyNode);
              classSymbol.children?.push({
                name: bodyNode.name || 'unknown',
                kind: SymbolKind.Method,
                line: bodyNode.lineno || 0,
                column: bodyNode.col_offset || 0,
                signature: this.buildFunctionSignature(bodyNode),
                docstring: this.extractDocstring(bodyNode),
                parent: node.name,
                calls: methodCalls
              });
            }
          });
        }

        symbols.push(classSymbol);
      } else if (nodeType === 'Assign') {
        // Variable assignments
        if (node.targets && node.targets.length > 0) {
          const target = node.targets[0];
          const targetType = target._type || target.type || target.kind || '';
          if (targetType === 'Name' && target.id) {
            symbols.push({
              name: target.id,
              kind: SymbolKind.Variable,
              line: node.lineno || 0,
              column: node.col_offset || 0
            });
          }
        }
      }
    });

    return symbols;
  }

  private extractOutline(ast: any): OutlineSection[] {
    const outline: OutlineSection[] = [];
    
    this.walkAST(ast, (node) => {
      const nodeType = node._type || node.type || node.kind || '';
      const startLine = node.lineno || 0;
      const endLine = this.findEndLine(node) || startLine;

      if (nodeType === 'Import' || nodeType === 'ImportFrom') {
        outline.push({
          title: 'Imports',
          level: 1,
          line: startLine
        });
      } else if (nodeType === 'FunctionDef' || nodeType === 'AsyncFunctionDef') {
        outline.push({
          title: `Function: ${node.name}`,
          level: 1,
          line: startLine
        });
      } else if (nodeType === 'ClassDef') {
        outline.push({
          title: `Class: ${node.name}`,
          level: 1,
          line: startLine
        });
      }
    });

    return outline;
  }

  private buildFunctionSignature(node: PythonASTNode): string {
    const name = node.name || 'unknown';
    const args = node.args?.args.map(arg => {
      let argStr = arg.arg;
      if (arg.annotation) {
        argStr += `: ${this.nodeToString(arg.annotation)}`;
      }
      return argStr;
    }).join(', ') || '';

    const nodeType = (node as any)._type || node.type || node.kind || '';
    let signature = `${nodeType === 'AsyncFunctionDef' ? 'async ' : ''}def ${name}(${args})`;
    
    if (node.returns) {
      signature += ` -> ${this.nodeToString(node.returns)}`;
    }

    return signature;
  }

  private extractDocstring(node: PythonASTNode): string | undefined {
    if (node.body && node.body.length > 0) {
      const firstStatement = node.body[0];
      const firstType = (firstStatement as any)._type || firstStatement.type;
      if (firstType === 'Expr') {
        const valueType = (firstStatement.value as any)?._type || firstStatement.value?.type;
        if (valueType === 'Constant' || valueType === 'Str') {
          return (firstStatement.value as any).value || (firstStatement.value as any).s || undefined;
        }
      }
    }
    return undefined;
  }

  private nodeToString(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    const nodeType = node._type || node.type;
    if (nodeType === 'Name') return node.id || '';
    if (nodeType === 'Str') return `"${node.s || ''}"`;
    if (nodeType === 'Constant') return String(node.value || '');
    if (nodeType === 'Num') return String(node.n || '');
    return nodeType || '';
  }

  private findEndLine(node: PythonASTNode): number | undefined {
    if (!node.body || !Array.isArray(node.body) || node.body.length === 0) {
      return node.lineno;
    }
    
    // Find the last line number in the body
    let maxLine = node.lineno || 0;
    for (const bodyNode of node.body) {
      if (bodyNode.lineno && bodyNode.lineno > maxLine) {
        maxLine = bodyNode.lineno;
      }
      const childEndLine = this.findEndLine(bodyNode);
      if (childEndLine && childEndLine > maxLine) {
        maxLine = childEndLine;
      }
    }
    return maxLine;
  }

  /**
   * Extract function calls from a function/method AST node
   */
  private extractCalls(functionNode: any): string[] {
    const calls = new Set<string>();
    
    // Walk through the function body to find call expressions
    this.walkAST(functionNode, (node) => {
      const nodeType = node._type || node.type || node.kind || '';
      
      if (nodeType === 'Call') {
        // Direct function calls: function_name()
        if (node.func) {
          const funcType = node.func._type || node.func.type || node.func.kind || '';
          
          if (funcType === 'Name' && node.func.id) {
            // Simple function call: func()
            calls.add(node.func.id);
          } else if (funcType === 'Attribute' && node.func.attr) {
            // Method call: obj.method() or module.function()
            const methodName = node.func.attr;
            calls.add(methodName);
            
            // If it's a qualified call, also add the full name
            if (node.func.value && node.func.value.id && node.func.value.id !== 'self') {
              calls.add(`${node.func.value.id}.${methodName}`);
            }
          }
        }
      }
      // Await expressions: await function_name()
      else if (nodeType === 'Await' && node.value) {
        const awaitType = node.value._type || node.value.type || node.value.kind || '';
        if (awaitType === 'Call' && node.value.func) {
          const funcType = node.value.func._type || node.value.func.type || node.value.func.kind || '';
          if (funcType === 'Name' && node.value.func.id) {
            calls.add(node.value.func.id);
          } else if (funcType === 'Attribute' && node.value.func.attr) {
            calls.add(node.value.func.attr);
          }
        }
      }
    });
    
    return Array.from(calls).sort();
  }

  private walkAST(node: any, callback: (node: any) => void) {
    if (!node) return;
    
    callback(node);
    
    // Recursively walk child nodes
    if (node.body && Array.isArray(node.body)) {
      node.body.forEach((child: any) => this.walkAST(child, callback));
    }
    
    // Handle other array properties that might contain child nodes
    ['orelse', 'finalbody', 'handlers'].forEach(prop => {
      const value = (node as any)[prop];
      if (Array.isArray(value)) {
        value.forEach((child: any) => this.walkAST(child, callback));
      }
    });
  }
}