import { Project, SourceFile, SyntaxKind, Node, Symbol } from 'ts-morph';
import { 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  SymbolInfo, 
  OutlineSection,
  SymbolKind,
  ComponentInfo,
  ApiEndpointInfo
} from '../types';

export class TypeScriptParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        skipLibCheck: true,
        target: 99, // ES2022
        module: 1, // CommonJS
      }
    });
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const sourceFile = this.project.createSourceFile(filePath, content, { overwrite: true });
    
    const result: ParseResult = {
      imports: this.extractImports(sourceFile),
      exports: this.extractExports(sourceFile),
      symbols: this.extractSymbols(sourceFile),
      outline: this.extractOutline(sourceFile)
    };

    // Enhance with React and API detection if applicable
    if (this.hasReactImports(sourceFile)) {
      result.reactComponents = this.extractReactComponents(sourceFile);
    }
    
    if (this.hasApiFrameworks(sourceFile)) {
      result.apiEndpoints = this.extractApiEndpoints(sourceFile);
    }

    return result;
  }

  private extractImports(sourceFile: SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // Import declarations: import { a, b } from 'module'
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const importClause = importDecl.getImportClause();
      
      if (!importClause) {
        // Side-effect import: import 'module'
        imports.push({ module: moduleSpecifier });
        return;
      }

      const symbols: string[] = [];
      let isDefault = false;
      let alias: string | undefined;

      // Default import: import defaultExport from 'module'
      const defaultImport = importClause.getDefaultImport();
      if (defaultImport) {
        symbols.push(defaultImport.getText());
        isDefault = true;
      }

      // Namespace import: import * as name from 'module'
      const namespaceImport = importClause.getNamespaceImport();
      if (namespaceImport) {
        alias = namespaceImport.getText();
      }

      // Named imports: import { a, b as c } from 'module'
      const namedImports = importClause.getNamedImports();
      if (namedImports) {
        namedImports.forEach((element: any) => {
          const name = element.getName();
          const aliasNode = element.getAliasNode();
          if (aliasNode) {
            symbols.push(`${name} as ${aliasNode.getText()}`);
          } else {
            symbols.push(name);
          }
        });
      }

      imports.push({
        module: moduleSpecifier,
        symbols: symbols.length > 0 ? symbols : undefined,
        isDefault,
        alias
      });
    });

    // Dynamic imports: import('module')
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
      const expression = callExpr.getExpression();
      if (expression.getKind() === SyntaxKind.ImportKeyword) {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const moduleArg = args[0];
          if (Node.isStringLiteral(moduleArg)) {
            imports.push({ 
              module: moduleArg.getLiteralValue(),
              symbols: ['dynamic']
            });
          }
        }
      }
    });

    return imports;
  }

  private extractExports(sourceFile: SourceFile): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // Export declarations
    sourceFile.getExportDeclarations().forEach(exportDecl => {
      const namedExports = exportDecl.getNamedExports();
      namedExports.forEach(namedExport => {
        const name = namedExport.getName();
        const alias = namedExport.getAliasNode();
        exports.push({
          name: alias ? alias.getText() : name,
          type: 'const', // We'll try to infer the actual type later
          line: exportDecl.getStartLineNumber()
        });
      });
    });

    // Export assignments: export = something
    sourceFile.getExportAssignments().forEach(exportAssignment => {
      if (exportAssignment.isExportEquals()) {
        exports.push({
          name: 'default',
          type: 'default',
          line: exportAssignment.getStartLineNumber()
        });
      }
    });

    // Function declarations with export
    sourceFile.getFunctions().forEach(func => {
      if (func.isExported()) {
        const signature = this.getFunctionSignature(func);
        exports.push({
          name: func.getName() || 'anonymous',
          type: 'function',
          line: func.getStartLineNumber(),
          signature
        });
      }
    });

    // Class declarations with export
    sourceFile.getClasses().forEach(cls => {
      if (cls.isExported()) {
        exports.push({
          name: cls.getName() || 'anonymous',
          type: 'class',
          line: cls.getStartLineNumber()
        });
      }
    });

    // Interface declarations with export
    sourceFile.getInterfaces().forEach(iface => {
      if (iface.isExported()) {
        exports.push({
          name: iface.getName(),
          type: 'interface',
          line: iface.getStartLineNumber()
        });
      }
    });

    // Type alias declarations with export
    sourceFile.getTypeAliases().forEach(typeAlias => {
      if (typeAlias.isExported()) {
        exports.push({
          name: typeAlias.getName(),
          type: 'type',
          line: typeAlias.getStartLineNumber()
        });
      }
    });

    // Variable declarations with export
    sourceFile.getVariableStatements().forEach(varStatement => {
      if (varStatement.isExported()) {
        varStatement.getDeclarations().forEach(decl => {
          const name = decl.getName();
          exports.push({
            name,
            type: varStatement.getDeclarationKind() as 'const' | 'let' | 'var',
            line: decl.getStartLineNumber()
          });
        });
      }
    });

    return exports;
  }

  private extractSymbols(sourceFile: SourceFile): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    // Functions
    sourceFile.getFunctions().forEach(func => {
      const signature = this.getFunctionSignature(func);
      const docString = this.getDocString(func);
      const calls = this.extractCalls(func);
      
      symbols.push({
        name: func.getName() || 'anonymous',
        kind: SymbolKind.Function,
        line: func.getStartLineNumber(),
        column: 0,
        endLine: func.getEndLineNumber(),
        endColumn: 0,
        signature,
        docstring: docString,
        calls: calls
      });
    });

    // Classes
    sourceFile.getClasses().forEach(cls => {
      const docString = this.getDocString(cls);
      const classSymbol: SymbolInfo = {
        name: cls.getName() || 'anonymous',
        kind: SymbolKind.Class,
        line: cls.getStartLineNumber(),
        column: 0,
        endLine: cls.getEndLineNumber(),
        endColumn: 0,
        docstring: docString,
        children: []
      };

      // Methods
      cls.getMethods().forEach(method => {
        const methodSignature = this.getMethodSignature(method);
        const methodDoc = this.getDocString(method);
        const methodCalls = this.extractCalls(method);
        
        classSymbol.children!.push({
          name: method.getName(),
          kind: SymbolKind.Method,
          line: method.getStartLineNumber(),
          column: 0,
          endLine: method.getEndLineNumber(),
          endColumn: 0,
          signature: methodSignature,
          docstring: methodDoc,
          parent: classSymbol.name,
          calls: methodCalls
        });
      });

      // Properties
      cls.getProperties().forEach(prop => {
        const propDoc = this.getDocString(prop);
        
        classSymbol.children!.push({
          name: prop.getName(),
          kind: SymbolKind.Property,
          line: prop.getStartLineNumber(),
          column: 0,
          docstring: propDoc,
          parent: classSymbol.name
        });
      });

      // Constructors
      cls.getConstructors().forEach(ctor => {
        const ctorSignature = this.getConstructorSignature(ctor);
        const ctorDoc = this.getDocString(ctor);
        const ctorCalls = this.extractCalls(ctor);
        
        classSymbol.children!.push({
          name: 'constructor',
          kind: SymbolKind.Constructor,
          line: ctor.getStartLineNumber(),
          column: 0,
          signature: ctorSignature,
          docstring: ctorDoc,
          parent: classSymbol.name,
          calls: ctorCalls
        });
      });

      symbols.push(classSymbol);
    });

    // Interfaces
    sourceFile.getInterfaces().forEach(iface => {
      const docString = this.getDocString(iface);
      const interfaceSymbol: SymbolInfo = {
        name: iface.getName(),
        kind: SymbolKind.Interface,
        line: iface.getStartLineNumber(),
        column: 0,
        endLine: iface.getEndLineNumber(),
        endColumn: 0,
        docstring: docString,
        children: []
      };

      // Methods
      iface.getMethods().forEach(method => {
        const methodSignature = this.getMethodSignature(method);
        
        interfaceSymbol.children!.push({
          name: method.getName(),
          kind: SymbolKind.Method,
          line: method.getStartLineNumber(),
          column: 0,
          signature: methodSignature,
          parent: interfaceSymbol.name
        });
      });

      // Properties
      iface.getProperties().forEach(prop => {
        interfaceSymbol.children!.push({
          name: prop.getName(),
          kind: SymbolKind.Property,
          line: prop.getStartLineNumber(),
          column: 0,
          parent: interfaceSymbol.name
        });
      });

      symbols.push(interfaceSymbol);
    });

    // Enums
    sourceFile.getEnums().forEach(enumDecl => {
      const docString = this.getDocString(enumDecl);
      const enumSymbol: SymbolInfo = {
        name: enumDecl.getName(),
        kind: SymbolKind.Enum,
        line: enumDecl.getStartLineNumber(),
        column: 0,
        endLine: enumDecl.getEndLineNumber(),
        endColumn: 0,
        docstring: docString,
        children: []
      };

      enumDecl.getMembers().forEach(member => {
        enumSymbol.children!.push({
          name: member.getName(),
          kind: SymbolKind.EnumMember,
          line: member.getStartLineNumber(),
          column: 0,
          parent: enumSymbol.name
        });
      });

      symbols.push(enumSymbol);
    });

    // Type aliases
    sourceFile.getTypeAliases().forEach(typeAlias => {
      const docString = this.getDocString(typeAlias);
      
      symbols.push({
        name: typeAlias.getName(),
        kind: SymbolKind.TypeParameter,
        line: typeAlias.getStartLineNumber(),
        column: 0,
        signature: `type ${typeAlias.getName()} = ${typeAlias.getTypeNode()?.getText()}`,
        docstring: docString
      });
    });

    // Variables
    sourceFile.getVariableStatements().forEach(varStatement => {
      varStatement.getDeclarations().forEach(decl => {
        const name = decl.getName();
        const kind = varStatement.getDeclarationKind();
        const symbolKind = kind === 'const' ? SymbolKind.Constant : SymbolKind.Variable;
        
        symbols.push({
          name,
          kind: symbolKind,
          line: decl.getStartLineNumber(),
          column: 0,
          signature: `${kind} ${name}: ${decl.getType().getText()}`
        });
      });
    });

    return symbols;
  }

  private extractOutline(sourceFile: SourceFile): OutlineSection[] {
    const outline: OutlineSection[] = [];

    // Import sections
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
      const firstImport = imports[0];
      const lastImport = imports[imports.length - 1];
      outline.push({
        title: 'Imports',
        level: 1,
        line: firstImport.getStartLineNumber()
      });
    }

    // Functions
    sourceFile.getFunctions().forEach(func => {
      outline.push({
        title: `Function: ${func.getName()}`,
        level: 1,
        line: func.getStartLineNumber()
      });
    });

    // Classes
    sourceFile.getClasses().forEach(cls => {
      outline.push({
        title: `Class: ${cls.getName()}`,
        level: 1,
        line: cls.getStartLineNumber()
      });
    });

    // Interfaces
    sourceFile.getInterfaces().forEach(iface => {
      outline.push({
        title: `Interface: ${iface.getName()}`,
        level: 1,
        line: iface.getStartLineNumber()
      });
    });

    // Type aliases
    sourceFile.getTypeAliases().forEach(typeAlias => {
      outline.push({
        title: `Type: ${typeAlias.getName()}`,
        level: 1,
        line: typeAlias.getStartLineNumber()
      });
    });

    // Exports
    const exports = sourceFile.getExportDeclarations();
    if (exports.length > 0) {
      const firstExport = exports[0];
      const lastExport = exports[exports.length - 1];
      outline.push({
        title: 'Exports',
        level: 1,
        line: firstExport.getStartLineNumber()
      });
    }

    return outline.sort((a, b) => a.line - b.line);
  }

  /**
   * Extract function calls from a function or method body
   */
  private extractCalls(node: any): string[] {
    console.log('extractCalls called for node:', node.getName?.() || 'unknown');
    const calls = new Set<string>();
    
    try {
      // Walk through the AST to find call expressions
      node.forEachDescendant((child: any) => {
      if (child.getKind() === SyntaxKind.CallExpression) {
        const expression = child.getExpression();
        
        // Direct function calls: functionName()
        if (expression.getKind() === SyntaxKind.Identifier) {
          calls.add(expression.getText());
        }
        // Method calls: obj.method() or this.method()
        else if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
          const propertyAccess = expression;
          const methodName = propertyAccess.getName();
          const objectName = propertyAccess.getExpression().getText();
          
          // Add both qualified and unqualified method names
          calls.add(methodName);
          if (objectName !== 'this') {
            calls.add(`${objectName}.${methodName}`);
          }
        }
        // Constructor calls: new ClassName()
        else if (child.getExpression().getKind() === SyntaxKind.NewExpression) {
          const newExpression = child.getExpression();
          const className = newExpression.getExpression()?.getText();
          if (className) {
            calls.add(className);
          }
        }
      }
      
      // Await expressions: await functionName()
      if (child.getKind() === SyntaxKind.AwaitExpression) {
        const awaitExpression = child.getExpression();
        if (awaitExpression?.getKind() === SyntaxKind.CallExpression) {
          const callExpr = awaitExpression.getExpression();
          if (callExpr?.getKind() === SyntaxKind.Identifier) {
            calls.add(callExpr.getText());
          }
        }
      }
      });
    } catch (error) {
      console.warn('Error in extractCalls:', error);
      return [];
    }
    
    const result = Array.from(calls).sort();
    if (result.length > 0) {
      console.log(`Found ${result.length} calls:`, result);
    }
    return result;
  }

  private getFunctionSignature(func: any): string {
    const name = func.getName() || 'anonymous';
    const params = func.getParameters().map((param: any) => {
      const paramName = param.getName();
      const paramType = param.getType().getText();
      return `${paramName}: ${paramType}`;
    }).join(', ');
    
    const returnType = func.getReturnType().getText();
    return `function ${name}(${params}): ${returnType}`;
  }

  private getMethodSignature(method: any): string {
    const name = method.getName();
    const params = method.getParameters().map((param: any) => {
      const paramName = param.getName();
      const paramType = param.getType().getText();
      return `${paramName}: ${paramType}`;
    }).join(', ');
    
    const returnType = method.getReturnType().getText();
    return `${name}(${params}): ${returnType}`;
  }

  private getConstructorSignature(ctor: any): string {
    const params = ctor.getParameters().map((param: any) => {
      const paramName = param.getName();
      const paramType = param.getType().getText();
      return `${paramName}: ${paramType}`;
    }).join(', ');
    
    return `constructor(${params})`;
  }

  private getDocString(node: any): string | undefined {
    const jsDocs = node.getJsDocs();
    if (jsDocs.length > 0) {
      const doc = jsDocs[0];
      const description = doc.getDescription();
      return description.trim() || undefined;
    }
    return undefined;
  }

  private hasReactImports(sourceFile: SourceFile): boolean {
    return sourceFile.getImportDeclarations().some(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      return moduleSpecifier === 'react' || moduleSpecifier.includes('react') || 
             moduleSpecifier.includes('jsx') || moduleSpecifier.includes('@types/react');
    });
  }

  private hasApiFrameworks(sourceFile: SourceFile): boolean {
    return sourceFile.getImportDeclarations().some(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      return ['express', 'koa', 'fastify', 'next', '@nestjs/common'].some(framework => 
        moduleSpecifier.includes(framework));
    });
  }

  private extractReactComponents(sourceFile: SourceFile): ComponentInfo[] {
    const components: ComponentInfo[] = [];

    // Find function components
    sourceFile.getFunctions().forEach(func => {
      if (this.isFunctionComponent(func)) {
        const propsParam = func.getParameters()[0];
        const propsType = propsParam ? this.getTypeString(propsParam.getTypeNode()) : undefined;
        
        components.push({
          name: func.getName() || 'AnonymousComponent',
          type: 'functional',
          line: func.getStartLineNumber(),
          propsType,
          hooks: this.extractHooks(func),
          isExported: func.isExported(),
          displayName: this.getDisplayName(func)
        });
      }
    });

    // Find variable components (arrow functions, forwardRef, memo, HOCs)
    sourceFile.getVariableDeclarations().forEach(varDecl => {
      const initializer = varDecl.getInitializer();
      if (initializer) {
        // Check for forwardRef components
        const forwardRefInfo = this.extractForwardRefComponent(initializer, varDecl);
        if (forwardRefInfo) {
          components.push(forwardRefInfo);
          return;
        }
        
        // Check for memo components
        const memoInfo = this.extractMemoComponent(initializer, varDecl);
        if (memoInfo) {
          components.push(memoInfo);
          return;
        }
        
        // Check for HOC usage (withLoading(Component))
        const hocInfo = this.extractHOCComponent(initializer, varDecl);
        if (hocInfo) {
          components.push(hocInfo);
          return;
        }
        
        // Regular arrow function components
        if (this.isComponentArrowFunction(initializer)) {
          const arrowFunc = initializer.asKindOrThrow(SyntaxKind.ArrowFunction);
          const propsParam = arrowFunc.getParameters()[0];
          const propsType = propsParam ? this.getTypeString(propsParam.getTypeNode()) : undefined;
          
          components.push({
            name: varDecl.getName(),
            type: 'functional',
            line: varDecl.getStartLineNumber(),
            propsType,
            hooks: this.extractHooks(arrowFunc),
            isExported: varDecl.isExported(),
            displayName: this.getDisplayName(varDecl)
          });
        }
      }
    });

    // Find class components
    sourceFile.getClasses().forEach(cls => {
      if (this.isClassComponent(cls)) {
        const propsInterface = this.getPropsInterface(cls);
        
        components.push({
          name: cls.getName() || 'AnonymousComponent',
          type: 'class',
          line: cls.getStartLineNumber(),
          propsType: propsInterface,
          hooks: [], // Class components don't use hooks
          isExported: cls.isExported(),
          displayName: this.getDisplayName(cls)
        });
      }
    });

    // Find HOC functions
    sourceFile.getFunctions().forEach(func => {
      if (this.isHOCFunction(func)) {
        components.push({
          name: func.getName() || 'AnonymousHOC',
          type: 'hoc' as any,
          line: func.getStartLineNumber(),
          hooks: [],
          isExported: func.isExported(),
          displayName: this.getDisplayName(func)
        });
      }
    });

    return components;
  }

  private extractApiEndpoints(sourceFile: SourceFile): ApiEndpointInfo[] {
    const endpoints: ApiEndpointInfo[] = [];

    // Find Express/Koa/Fastify-style routes
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(callExpr => {
      const expression = callExpr.getExpression();
      
      if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        const methodName = propAccess.getName();
        const objectName = propAccess.getExpression().getText();
        const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
        
        if (httpMethods.includes(methodName.toLowerCase())) {
          const args = callExpr.getArguments();
          if (args.length >= 2) {
            const pathArg = args[0];
            const handlerArg = args[args.length - 1];
            
            let path = 'unknown';
            if (pathArg.getKind() === SyntaxKind.StringLiteral) {
              path = pathArg.getText().replace(/['"]/g, '');
            }
            
            let handler = 'anonymous';
            if (handlerArg.getKind() === SyntaxKind.Identifier) {
              handler = handlerArg.getText();
            } else if (handlerArg.getKind() === SyntaxKind.ArrowFunction) {
              handler = 'arrow function';
            }
            
            // Detect framework based on the specific call pattern
            let framework: 'express' | 'koa' | 'fastify' | 'nextjs' | 'nestjs' = this.detectFrameworkFromCall(callExpr, objectName, sourceFile);
            
            endpoints.push({
              method: methodName.toUpperCase(),
              path,
              handler,
              line: callExpr.getStartLineNumber(),
              framework,
              middleware: this.extractMiddleware(callExpr)
            });
          }
        }
      }
    });

    // Check for Next.js API route exports
    sourceFile.getFunctions().forEach(func => {
      const name = func.getName();
      if (func.isExported() && name && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name)) {
        endpoints.push({
          method: name,
          path: '/api/[route]', // Next.js uses file-based routing
          handler: 'Next.js API handler',
          line: func.getStartLineNumber(),
          framework: 'nextjs',
          middleware: []
        });
      }
    });

    return endpoints;
  }

  private isFunctionComponent(func: any): boolean {
    // Check if function returns JSX
    const returnType = func.getReturnTypeNode()?.getText();
    if (returnType && (returnType.includes('JSX') || returnType.includes('ReactElement'))) {
      return true;
    }

    // Check if function body contains JSX return
    const body = func.getBody();
    if (body) {
      const hasJSXReturn = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
        .some((returnStmt: any) => {
          const expr = returnStmt.getExpression();
          return expr && this.containsJSX(expr);
        });
      if (hasJSXReturn) return true;
    }

    // Check function name pattern
    const name = func.getName();
    return name && /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  private isComponentArrowFunction(node: any): boolean {
    if (node.getKind() !== SyntaxKind.ArrowFunction) return false;
    
    const body = node.getBody();
    if (!body) return false;
    
    // Check for JSX return
    if (this.containsJSX(body)) return true;
    
    // Check return statements
    if (body.getKind() === SyntaxKind.Block) {
      return body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
        .some((returnStmt: any) => {
          const expr = returnStmt.getExpression();
          return expr && this.containsJSX(expr);
        });
    }
    
    return false;
  }

  private isClassComponent(cls: any): boolean {
    const heritage = cls.getHeritageClauses();
    return heritage.some((clause: any) => {
      const types = clause.getTypeNodes();
      return types.some((type: any) => {
        const text = type.getText();
        return text.includes('Component') || text.includes('PureComponent');
      });
    });
  }

  private containsJSX(node: any): boolean {
    if (!node) return false;
    
    // Check for JSX elements or fragments
    const jsxKinds = [
      SyntaxKind.JsxElement,
      SyntaxKind.JsxSelfClosingElement,
      SyntaxKind.JsxFragment
    ];
    
    return jsxKinds.some(kind => node.getDescendantsOfKind(kind).length > 0);
  }

  private extractHooks(node: any): string[] {
    const hooks: string[] = [];
    
    if (node) {
      node.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr: any) => {
        const expression = callExpr.getExpression();
        if (expression.getKind() === SyntaxKind.Identifier) {
          const name = expression.getText();
          if (name.startsWith('use') && name.length > 3) {
            hooks.push(name);
          }
        }
      });
    }
    
    return [...new Set(hooks)]; // Remove duplicates
  }

  private getPropsInterface(cls: any): string | undefined {
    const heritage = cls.getHeritageClauses();
    for (const clause of heritage) {
      const types = clause.getTypeNodes();
      for (const type of types) {
        const typeArgs = type.getTypeArguments();
        if (typeArgs && typeArgs.length > 0) {
          return typeArgs[0].getText();
        }
      }
    }
    return undefined;
  }

  private extractForwardRefComponent(initializer: any, varDecl: any): ComponentInfo | null {
    if (initializer.getKind() === SyntaxKind.CallExpression) {
      const callExpr = initializer.asKindOrThrow(SyntaxKind.CallExpression);
      const expression = callExpr.getExpression();
      
      if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'forwardRef') {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const componentArg = args[0];
          let hooks: string[] = [];
          let propsType: string | undefined;
          
          if (componentArg.getKind() === SyntaxKind.ArrowFunction) {
            const arrowFunc = componentArg.asKindOrThrow(SyntaxKind.ArrowFunction);
            hooks = this.extractHooks(arrowFunc);
            const propsParam = arrowFunc.getParameters()[0];
            propsType = propsParam ? this.getTypeString(propsParam.getTypeNode()) : undefined;
          }
          
          // Get type arguments from forwardRef<RefType, PropsType>
          const typeArgs = callExpr.getTypeArguments();
          if (typeArgs.length > 1) {
            propsType = typeArgs[1].getText();
          }
          
          return {
            name: varDecl.getName(),
            type: 'forwardRef' as any,
            line: varDecl.getStartLineNumber(),
            propsType,
            hooks,
            isExported: varDecl.isExported(),
            displayName: this.getDisplayName(varDecl)
          };
        }
      }
    }
    return null;
  }
  
  private extractMemoComponent(initializer: any, varDecl: any): ComponentInfo | null {
    if (initializer.getKind() === SyntaxKind.CallExpression) {
      const callExpr = initializer.asKindOrThrow(SyntaxKind.CallExpression);
      const expression = callExpr.getExpression();
      
      if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'memo') {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const componentArg = args[0];
          let hooks: string[] = [];
          let propsType: string | undefined;
          
          if (componentArg.getKind() === SyntaxKind.ArrowFunction) {
            const arrowFunc = componentArg.asKindOrThrow(SyntaxKind.ArrowFunction);
            hooks = this.extractHooks(arrowFunc);
            const propsParam = arrowFunc.getParameters()[0];
            propsType = propsParam ? this.getTypeString(propsParam.getTypeNode()) : undefined;
          }
          
          // Get type arguments from memo<PropsType>
          const typeArgs = callExpr.getTypeArguments();
          if (typeArgs.length > 0) {
            propsType = typeArgs[0].getText();
          }
          
          return {
            name: varDecl.getName(),
            type: 'memo' as any,
            line: varDecl.getStartLineNumber(),
            propsType,
            hooks,
            isExported: varDecl.isExported(),
            displayName: this.getDisplayName(varDecl)
          };
        }
      }
    }
    return null;
  }
  
  private extractHOCComponent(initializer: any, varDecl: any): ComponentInfo | null {
    if (initializer.getKind() === SyntaxKind.CallExpression) {
      const callExpr = initializer.asKindOrThrow(SyntaxKind.CallExpression);
      const expression = callExpr.getExpression();
      
      // Check if it's a function call that could be an HOC
      if (expression.getKind() === SyntaxKind.Identifier) {
        const functionName = expression.getText();
        const args = callExpr.getArguments();
        
        // HOCs typically start with 'with' and take a component as argument
        if (functionName.startsWith('with') && args.length > 0) {
          const componentArg = args[0];
          
          return {
            name: varDecl.getName(),
            type: 'hoc-wrapped' as any,
            line: varDecl.getStartLineNumber(),
            hooks: [], // Can't determine hooks from HOC usage
            isExported: varDecl.isExported(),
            displayName: this.getDisplayName(varDecl),
            wrappedComponent: componentArg.getText(),
            hocFunction: functionName
          } as any;
        }
      }
    }
    return null;
  }
  
  private isHOCFunction(func: any): boolean {
    const name = func.getName();
    if (!name || !name.startsWith('with')) return false;
    
    // Check function parameters - HOCs typically take a component as parameter
    const params = func.getParameters();
    const hasComponentParam = params.some((param: any) => {
      const typeNode = param.getTypeNode();
      if (typeNode) {
        const typeText = typeNode.getText();
        return typeText.includes('ComponentType') || typeText.includes('React.ComponentType');
      }
      return false;
    });
    
    if (hasComponentParam) {
      return true;
    }
    
    // Check if function returns a component
    const returnType = func.getReturnTypeNode()?.getText();
    if (returnType && (returnType.includes('ComponentType') || returnType.includes('ReactElement'))) {
      return true;
    }
    
    // Check if function body returns JSX or a component
    const body = func.getBody();
    if (body) {
      const returnStatements = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
      return returnStatements.some((stmt: any) => {
        const expr = stmt.getExpression();
        return expr && (this.containsJSX(expr) || this.looksLikeComponentReturn(expr));
      });
    }
    
    return false;
  }
  
  private looksLikeComponentReturn(expr: any): boolean {
    // Check if returning a function that looks like a component
    if (expr.getKind() === SyntaxKind.ArrowFunction || expr.getKind() === SyntaxKind.FunctionExpression) {
      return this.containsJSX(expr.getBody());
    }
    
    // Check if returning a call to a component-like function
    if (expr.getKind() === SyntaxKind.CallExpression) {
      const callee = expr.getExpression();
      if (callee.getKind() === SyntaxKind.Identifier) {
        const name = callee.getText();
        return /^[A-Z]/.test(name); // Starts with capital letter
      }
    }
    
    return false;
  }

  private getDisplayName(node: any): string | undefined {
    // Look for displayName property assignment
    const parent = node.getParent();
    if (parent) {
      const statements = parent.getStatements?.() || [];
      for (const stmt of statements as any[]) {
        if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
          const expr = stmt.getExpression();
          if (expr && expr.getKind() === SyntaxKind.BinaryExpression) {
            const left = expr.getLeft();
            if (left.getText().includes('.displayName')) {
              const right = expr.getRight();
              if (right.getKind() === SyntaxKind.StringLiteral) {
                return right.getText().replace(/['"]/g, '');
              }
            }
          }
        }
      }
    }
    return undefined;
  }

  private getTypeString(typeNode: any): string | undefined {
    return typeNode ? typeNode.getText() : undefined;
  }

  private detectFramework(sourceFile: SourceFile): 'express' | 'koa' | 'fastify' | 'nextjs' | 'nestjs' {
    const imports = sourceFile.getImportDeclarations();
    
    // First check imports - most reliable indicator
    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Exact matches first (most specific)
      if (moduleSpecifier === 'express') return 'express';
      if (moduleSpecifier === 'koa') return 'koa';
      if (moduleSpecifier === 'fastify') return 'fastify';
      if (moduleSpecifier.startsWith('@nestjs/')) return 'nestjs';
      if (moduleSpecifier === 'next' || moduleSpecifier.startsWith('next/')) return 'nextjs';
      
      // Check for router imports that indicate specific frameworks
      if (moduleSpecifier === 'koa-router') return 'koa';
    }
    
    // Check for Next.js API route patterns (export async function GET/POST)
    const hasNextApiRoutes = sourceFile.getFunctions().some(func => {
      const name = func.getName();
      return func.isExported() && name && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name);
    });
    
    if (hasNextApiRoutes) {
      return 'nextjs';
    }
    
    // Check for actual NestJS decorators (not simulated ones)
    const hasRealNestDecorators = sourceFile.getClasses().some(cls => {
      // Check if this is a controller with actual NestJS imports
      const hasNestImports = imports.some(imp => 
        imp.getModuleSpecifierValue().startsWith('@nestjs/'));
      
      if (!hasNestImports) return false;
      
      return cls.getDecorators().some(decorator => {
        const decoratorText = decorator.getFullText();
        return decoratorText.includes('Controller') || decoratorText.includes('Injectable');
      });
    });
    
    if (hasRealNestDecorators) {
      return 'nestjs';
    }
    
    // Check for framework-specific patterns in variable initializations
    const variableDecls = sourceFile.getVariableDeclarations();
    for (const varDecl of variableDecls) {
      const initializer = varDecl.getInitializer();
      if (initializer) {
        const initText = initializer.getText();
        if (initText.includes('express()')) return 'express';
        if (initText.includes('new Koa()')) return 'koa';
        if (initText.includes('fastify()')) return 'fastify';
      }
    }
    
    // Check method call patterns to infer framework
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const expression = callExpr.getExpression();
      if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        const objectName = propAccess.getExpression().getText();
        const methodName = propAccess.getName();
        
        // Koa uses ctx parameter in router methods
        if (objectName === 'router' && ['get', 'post', 'put', 'delete'].includes(methodName)) {
          const args = callExpr.getArguments();
          if (args.length >= 2) {
            const handlerArg = args[args.length - 1];
            if (handlerArg.getText().includes('ctx')) {
              return 'koa';
            }
          }
        }
        
        // Fastify uses specific method signatures
        if (objectName === 'server' && ['get', 'post', 'put', 'delete'].includes(methodName)) {
          return 'fastify';
        }
      }
    }
    
    return 'express'; // Final fallback
  }

  private detectFrameworkFromCall(callExpr: any, objectName: string, sourceFile: SourceFile): 'express' | 'koa' | 'fastify' | 'nextjs' | 'nestjs' {
    const args = callExpr.getArguments();
    
    // Check the handler signature to determine framework
    if (args.length >= 2) {
      const handlerArg = args[args.length - 1];
      if (handlerArg.getKind() === SyntaxKind.ArrowFunction) {
        const arrowFunc = handlerArg.asKindOrThrow(SyntaxKind.ArrowFunction);
        const params = arrowFunc.getParameters();
        
        if (params.length >= 1) {
          const firstParam = params[0].getName();
          const secondParam = params.length > 1 ? params[1].getName() : '';
          
          // Koa uses (ctx) or (ctx, next)
          if (firstParam === 'ctx' || (firstParam === 'ctx' && secondParam === 'next')) {
            return 'koa';
          }
          
          // Express uses (req, res) or (req, res, next)
          if (firstParam === 'req' && secondParam === 'res') {
            return 'express';
          }
          
          // Fastify uses (request, reply)
          if (firstParam === 'request' && secondParam === 'reply') {
            return 'fastify';
          }
        }
      }
    }
    
    // Check object name patterns
    if (objectName === 'router') {
      // Could be Express router or Koa router - check imports
      const imports = sourceFile.getImportDeclarations();
      for (const importDecl of imports) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (moduleSpecifier === 'koa-router') return 'koa';
      }
      return 'express'; // Default for router
    }
    
    if (objectName === 'app') {
      // Check what app was initialized as
      const variableDecls = sourceFile.getVariableDeclarations();
      for (const varDecl of variableDecls) {
        if (varDecl.getName() === 'app') {
          const initializer = varDecl.getInitializer();
          if (initializer) {
            const initText = initializer.getText();
            if (initText.includes('express()')) return 'express';
            if (initText.includes('new Koa()')) return 'koa';
          }
        }
      }
    }
    
    if (objectName === 'server') {
      // Likely Fastify
      return 'fastify';
    }
    
    // Fallback to global detection
    return this.detectFramework(sourceFile);
  }
  
  private extractMiddleware(callExpr: any): string[] {
    const args = callExpr.getArguments();
    const middleware: string[] = [];
    
    // Middleware are typically the arguments between path and handler
    for (let i = 1; i < args.length - 1; i++) {
      const arg = args[i];
      if (arg.getKind() === SyntaxKind.Identifier) {
        middleware.push(arg.getText());
      }
    }
    
    return middleware;
  }
}