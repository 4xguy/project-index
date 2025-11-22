import Parser from 'tree-sitter';
import * as Go from 'tree-sitter-go';
import { 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  SymbolInfo, 
  OutlineSection,
  SymbolKind 
} from '../types';

interface GoASTNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children?: GoASTNode[];
  text?: string;
}

export class GoParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Go as any);
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    try {
      const tree = this.parser.parse(content);
      const rootNode = tree.rootNode;

      return {
        imports: this.extractImports(rootNode, content),
        exports: this.extractExports(rootNode, content),
        symbols: this.extractSymbols(rootNode, content),
        outline: this.extractOutline(rootNode, content)
      };
    } catch (error) {
      console.warn(`Failed to parse Go file ${filePath}:`, error);
      return {
        imports: [],
        exports: [],
        symbols: [],
        outline: []
      };
    }
  }

  private extractImports(rootNode: any, content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    this.walkAST(rootNode, (node: any) => {
      if (node.type === 'import_declaration') {
        this.processImportDeclaration(node, content, imports);
      }
    });

    return imports;
  }

  private processImportDeclaration(node: any, content: string, imports: ImportInfo[]) {
    // Handle import specifications within the declaration
    this.walkAST(node, (child: any) => {
      if (child.type === 'import_spec') {
        const packagePath = this.getNodeText(child, content);
        let alias: string | undefined;
        let module = packagePath.replace(/['"]/g, ''); // Remove quotes

        // Check for alias (import alias "package/path")
        if (child.children && child.children.length > 1) {
          const firstChild = child.children[0];
          if (firstChild.type === 'package_identifier') {
            alias = this.getNodeText(firstChild, content);
            module = this.getNodeText(child.children[1], content).replace(/['"]/g, '');
          }
        }

        // Check for dot import (import . "package/path")
        if (packagePath.includes('.')) {
          const parts = packagePath.split(' ');
          if (parts.length === 2 && parts[0] === '.') {
            module = parts[1].replace(/['"]/g, '');
            alias = '.';
          }
        }

        imports.push({
          module,
          alias,
          symbols: alias ? [alias] : [this.getPackageNameFromPath(module)]
        });
      }
    });
  }

  private extractExports(rootNode: any, content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    this.walkAST(rootNode, (node: any) => {
      const startLine = node.startPosition?.row + 1 || 0;

      switch (node.type) {
        case 'function_declaration':
          if (this.isExported(node, content)) {
            const name = this.getFunctionName(node, content);
            const signature = this.getFunctionSignature(node, content);
            exports.push({
              name,
              type: 'function',
              line: startLine,
              signature
            });
          }
          break;

        case 'method_declaration':
          if (this.isExported(node, content)) {
            const name = this.getMethodName(node, content);
            const signature = this.getMethodSignature(node, content);
            exports.push({
              name,
              type: 'function',
              line: startLine,
              signature
            });
          }
          break;

        case 'type_declaration':
          this.processTypeDeclaration(node, content, exports, startLine);
          break;

        case 'var_declaration':
        case 'const_declaration':
          this.processVariableDeclaration(node, content, exports, startLine);
          break;
      }
    });

    return exports;
  }

  private extractSymbols(rootNode: any, content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    this.walkAST(rootNode, (node: any) => {
      const startLine = node.startPosition?.row + 1 || 0;
      const endLine = node.endPosition?.row + 1 || 0;

      switch (node.type) {
        case 'function_declaration':
          const funcName = this.getFunctionName(node, content);
          const funcSignature = this.getFunctionSignature(node, content);
          const funcCalls = this.extractCalls(node, content);
          
          symbols.push({
            name: funcName,
            kind: SymbolKind.Function,
            line: startLine,
            column: node.startPosition?.column || 0,
            endLine,
            endColumn: node.endPosition?.column || 0,
            signature: funcSignature,
            calls: funcCalls
          });
          break;

        case 'method_declaration':
          const methodName = this.getMethodName(node, content);
          const methodSignature = this.getMethodSignature(node, content);
          const methodCalls = this.extractCalls(node, content);
          
          symbols.push({
            name: methodName,
            kind: SymbolKind.Method,
            line: startLine,
            column: node.startPosition?.column || 0,
            endLine,
            endColumn: node.endPosition?.column || 0,
            signature: methodSignature,
            calls: methodCalls
          });
          break;

        case 'type_declaration':
          this.processTypeDeclarationSymbols(node, content, symbols, startLine, endLine);
          break;

        case 'var_declaration':
        case 'const_declaration':
          this.processVariableDeclarationSymbols(node, content, symbols, startLine);
          break;
      }
    });

    return symbols;
  }

  private extractOutline(rootNode: any, content: string): OutlineSection[] {
    const outline: OutlineSection[] = [];

    this.walkAST(rootNode, (node: any) => {
      const startLine = node.startPosition?.row + 1 || 0;

      switch (node.type) {
        case 'package_clause':
          const packageName = this.getPackageName(node, content);
          outline.push({
            title: `Package: ${packageName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'import_declaration':
          outline.push({
            title: 'Imports',
            level: 1,
            line: startLine
          });
          break;

        case 'function_declaration':
          const funcName = this.getFunctionName(node, content);
          outline.push({
            title: `Function: ${funcName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'method_declaration':
          const methodName = this.getMethodName(node, content);
          outline.push({
            title: `Method: ${methodName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'type_declaration':
          this.processTypeDeclarationOutline(node, content, outline, startLine);
          break;
      }
    });

    return outline.sort((a, b) => a.line - b.line);
  }

  private processTypeDeclaration(node: any, content: string, exports: ExportInfo[], startLine: number) {
    this.walkAST(node, (child: any) => {
      if (child.type === 'type_spec') {
        const typeName = this.getTypeName(child, content);
        if (this.isExported(child, content)) {
          const typeKind = this.getTypeKind(child, content);
          exports.push({
            name: typeName,
            type: typeKind as any,
            line: startLine,
            signature: this.getTypeSignature(child, content)
          });
        }
      }
    });
  }

  private processVariableDeclaration(node: any, content: string, exports: ExportInfo[], startLine: number) {
    this.walkAST(node, (child: any) => {
      if (child.type === 'var_spec' || child.type === 'const_spec') {
        const varNames = this.getVariableNames(child, content);
        varNames.forEach(name => {
          if (this.isExportedName(name)) {
            exports.push({
              name,
              type: node.type === 'const_declaration' ? 'const' : 'var',
              line: startLine
            });
          }
        });
      }
    });
  }

  private processTypeDeclarationSymbols(node: any, content: string, symbols: SymbolInfo[], startLine: number, endLine: number) {
    this.walkAST(node, (child: any) => {
      if (child.type === 'type_spec') {
        const typeName = this.getTypeName(child, content);
        const typeKind = this.getTypeKind(child, content);
        
        let symbolKind: SymbolKind;
        switch (typeKind) {
          case 'struct':
            symbolKind = SymbolKind.Struct;
            break;
          case 'interface':
            symbolKind = SymbolKind.Interface;
            break;
          default:
            symbolKind = SymbolKind.TypeParameter;
        }

        const typeSymbol: SymbolInfo = {
          name: typeName,
          kind: symbolKind,
          line: startLine,
          column: child.startPosition?.column || 0,
          endLine,
          endColumn: child.endPosition?.column || 0,
          signature: this.getTypeSignature(child, content),
          children: []
        };

        // Extract struct fields or interface methods
        if (typeKind === 'struct') {
          this.extractStructFields(child, content, typeSymbol);
        } else if (typeKind === 'interface') {
          this.extractInterfaceMethods(child, content, typeSymbol);
        }

        symbols.push(typeSymbol);
      }
    });
  }

  private processVariableDeclarationSymbols(node: any, content: string, symbols: SymbolInfo[], startLine: number) {
    this.walkAST(node, (child: any) => {
      if (child.type === 'var_spec' || child.type === 'const_spec') {
        const varNames = this.getVariableNames(child, content);
        varNames.forEach(name => {
          const symbolKind = node.type === 'const_declaration' ? SymbolKind.Constant : SymbolKind.Variable;
          symbols.push({
            name,
            kind: symbolKind,
            line: startLine,
            column: child.startPosition?.column || 0
          });
        });
      }
    });
  }

  private processTypeDeclarationOutline(node: any, content: string, outline: OutlineSection[], startLine: number) {
    this.walkAST(node, (child: any) => {
      if (child.type === 'type_spec') {
        const typeName = this.getTypeName(child, content);
        const typeKind = this.getTypeKind(child, content);
        outline.push({
          title: `${typeKind.charAt(0).toUpperCase() + typeKind.slice(1)}: ${typeName}`,
          level: 1,
          line: startLine
        });
      }
    });
  }

  private extractStructFields(typeNode: any, content: string, parentSymbol: SymbolInfo) {
    this.walkAST(typeNode, (node: any) => {
      if (node.type === 'field_declaration') {
        const fieldNames = this.getFieldNames(node, content);
        fieldNames.forEach(fieldName => {
          parentSymbol.children!.push({
            name: fieldName,
            kind: SymbolKind.Field,
            line: node.startPosition?.row + 1 || 0,
            column: node.startPosition?.column || 0,
            parent: parentSymbol.name
          });
        });
      }
    });
  }

  private extractInterfaceMethods(typeNode: any, content: string, parentSymbol: SymbolInfo) {
    this.walkAST(typeNode, (node: any) => {
      if (node.type === 'method_spec') {
        const methodName = this.getMethodSpecName(node, content);
        const methodSignature = this.getMethodSpecSignature(node, content);
        parentSymbol.children!.push({
          name: methodName,
          kind: SymbolKind.Method,
          line: node.startPosition?.row + 1 || 0,
          column: node.startPosition?.column || 0,
          signature: methodSignature,
          parent: parentSymbol.name
        });
      }
    });
  }

  private extractCalls(node: any, content: string): string[] {
    const calls = new Set<string>();

    this.walkAST(node, (child: any) => {
      if (child.type === 'call_expression') {
        const functionName = this.getCallExpressionName(child, content);
        if (functionName) {
          calls.add(functionName);
        }
      }
    });

    return Array.from(calls).sort();
  }

  // Helper methods for extracting information from AST nodes

  private isExported(node: any, content: string): boolean {
    const name = this.getNodeName(node, content);
    return this.isExportedName(name);
  }

  private isExportedName(name: string): boolean {
    return Boolean(name && name.length > 0 && name[0] === name[0].toUpperCase());
  }

  private getNodeName(node: any, content: string): string {
    // Try to find identifier in children
    for (const child of node.children || []) {
      if (child.type === 'identifier') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getFunctionName(node: any, content: string): string {
    return this.getNodeName(node, content);
  }

  private getMethodName(node: any, content: string): string {
    return this.getNodeName(node, content);
  }

  private getTypeName(node: any, content: string): string {
    return this.getNodeName(node, content);
  }

  private getPackageName(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'package_identifier') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getFunctionSignature(node: any, content: string): string {
    const name = this.getFunctionName(node, content);
    const params = this.getParameterList(node, content);
    const returnType = this.getReturnType(node, content);
    return `func ${name}(${params})${returnType}`;
  }

  private getMethodSignature(node: any, content: string): string {
    const name = this.getMethodName(node, content);
    const receiver = this.getReceiver(node, content);
    const params = this.getParameterList(node, content);
    const returnType = this.getReturnType(node, content);
    return `func ${receiver}${name}(${params})${returnType}`;
  }

  private getTypeSignature(node: any, content: string): string {
    const typeName = this.getTypeName(node, content);
    const typeKind = this.getTypeKind(node, content);
    const typeDeclaration = this.getTypeDeclaration(node, content);
    return `type ${typeName} ${typeDeclaration}`;
  }

  private getTypeKind(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'struct_type') return 'struct';
      if (child.type === 'interface_type') return 'interface';
      if (child.type === 'slice_type') return 'slice';
      if (child.type === 'map_type') return 'map';
      if (child.type === 'channel_type') return 'channel';
      if (child.type === 'function_type') return 'function';
    }
    return 'type';
  }

  private getParameterList(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'parameter_list') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getReturnType(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'parameter_list' && child !== node.children[0]) {
        // Second parameter_list is return type
        return ` ${this.getNodeText(child, content)}`;
      }
    }
    return '';
  }

  private getReceiver(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'parameter_list') {
        const receiverText = this.getNodeText(child, content);
        return receiverText ? `${receiverText} ` : '';
      }
    }
    return '';
  }

  private getTypeDeclaration(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type !== 'identifier' && child.type !== 'type') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getVariableNames(node: any, content: string): string[] {
    const names: string[] = [];
    for (const child of node.children || []) {
      if (child.type === 'identifier') {
        names.push(this.getNodeText(child, content));
      }
    }
    return names;
  }

  private getFieldNames(node: any, content: string): string[] {
    const names: string[] = [];
    for (const child of node.children || []) {
      if (child.type === 'field_identifier') {
        names.push(this.getNodeText(child, content));
      }
    }
    return names;
  }

  private getMethodSpecName(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'field_identifier') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getMethodSpecSignature(node: any, content: string): string {
    const name = this.getMethodSpecName(node, content);
    const functionType = this.getFunctionTypeFromMethodSpec(node, content);
    return `${name}${functionType}`;
  }

  private getFunctionTypeFromMethodSpec(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'function_type') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getCallExpressionName(node: any, content: string): string {
    if (node.children && node.children.length > 0) {
      const functionNode = node.children[0];
      if (functionNode.type === 'identifier') {
        return this.getNodeText(functionNode, content);
      } else if (functionNode.type === 'selector_expression') {
        return this.getNodeText(functionNode, content);
      }
    }
    return '';
  }

  private getPackageNameFromPath(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }

  private getNodeText(node: any, content: string): string {
    if (!node || !node.startPosition || !node.endPosition) {
      return '';
    }
    
    const lines = content.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    const startCol = node.startPosition.column;
    const endCol = node.endPosition.column;
    
    if (startLine === endLine) {
      return lines[startLine]?.substring(startCol, endCol) || '';
    } else {
      let result = lines[startLine]?.substring(startCol) || '';
      for (let i = startLine + 1; i < endLine; i++) {
        result += '\n' + (lines[i] || '');
      }
      result += '\n' + (lines[endLine]?.substring(0, endCol) || '');
      return result;
    }
  }

  private walkAST(node: any, callback: (node: any) => void) {
    if (!node) return;
    
    callback(node);
    
    if (node.children) {
      for (const child of node.children) {
        this.walkAST(child, callback);
      }
    }
  }
}