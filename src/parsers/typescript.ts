import { Project, SourceFile, SyntaxKind, Node, Symbol } from 'ts-morph';
import { 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  SymbolInfo, 
  OutlineSection,
  SymbolKind 
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
    
    return {
      imports: this.extractImports(sourceFile),
      exports: this.extractExports(sourceFile),
      symbols: this.extractSymbols(sourceFile),
      outline: this.extractOutline(sourceFile)
    };
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
      
      symbols.push({
        name: func.getName() || 'anonymous',
        kind: SymbolKind.Function,
        line: func.getStartLineNumber(),
        column: 0,
        endLine: func.getEndLineNumber(),
        endColumn: 0,
        signature,
        docstring: docString
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
        
        classSymbol.children!.push({
          name: method.getName(),
          kind: SymbolKind.Method,
          line: method.getStartLineNumber(),
          column: 0,
          endLine: method.getEndLineNumber(),
          endColumn: 0,
          signature: methodSignature,
          docstring: methodDoc,
          parent: classSymbol.name
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
        
        classSymbol.children!.push({
          name: 'constructor',
          kind: SymbolKind.Constructor,
          line: ctor.getStartLineNumber(),
          column: 0,
          signature: ctorSignature,
          docstring: ctorDoc,
          parent: classSymbol.name
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
        type: 'import',
        lines: [firstImport.getStartLineNumber(), lastImport.getEndLineNumber()]
      });
    }

    // Functions
    sourceFile.getFunctions().forEach(func => {
      outline.push({
        type: 'function',
        name: func.getName(),
        lines: [func.getStartLineNumber(), func.getEndLineNumber()]
      });
    });

    // Classes
    sourceFile.getClasses().forEach(cls => {
      outline.push({
        type: 'class',
        name: cls.getName(),
        lines: [cls.getStartLineNumber(), cls.getEndLineNumber()]
      });
    });

    // Interfaces
    sourceFile.getInterfaces().forEach(iface => {
      outline.push({
        type: 'interface',
        name: iface.getName(),
        lines: [iface.getStartLineNumber(), iface.getEndLineNumber()]
      });
    });

    // Type aliases
    sourceFile.getTypeAliases().forEach(typeAlias => {
      outline.push({
        type: 'type',
        name: typeAlias.getName(),
        lines: [typeAlias.getStartLineNumber(), typeAlias.getEndLineNumber()]
      });
    });

    // Exports
    const exports = sourceFile.getExportDeclarations();
    if (exports.length > 0) {
      const firstExport = exports[0];
      const lastExport = exports[exports.length - 1];
      outline.push({
        type: 'export',
        lines: [firstExport.getStartLineNumber(), lastExport.getEndLineNumber()]
      });
    }

    return outline.sort((a, b) => a.lines[0] - b.lines[0]);
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
}