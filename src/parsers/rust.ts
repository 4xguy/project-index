import Parser from 'tree-sitter';
import * as Rust from 'tree-sitter-rust';
import { 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  SymbolInfo, 
  OutlineSection,
  SymbolKind 
} from '../types';

interface RustASTNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children?: RustASTNode[];
  text?: string;
}

export class RustParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Rust as any);
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
      console.warn(`Failed to parse Rust file ${filePath}:`, error);
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

    this.walkAST(rootNode, (node: any) => {
      if (node.type === 'use_declaration') {
        this.processUseDeclaration(node, content, imports);
      } else if (node.type === 'extern_crate_declaration') {
        this.processExternCrateDeclaration(node, content, imports);
      }
    });

    return imports;
  }

  private processUseDeclaration(node: any, content: string, imports: ImportInfo[]) {
    const useClause = this.findChildByType(node, 'use_clause');
    if (useClause) {
      const module = this.extractModulePath(useClause, content);
      const symbols = this.extractImportSymbols(useClause, content);
      const alias = this.extractImportAlias(useClause, content);

      imports.push({
        module,
        symbols: symbols.length > 0 ? symbols : undefined,
        alias
      });
    }
  }

  private processExternCrateDeclaration(node: any, content: string, imports: ImportInfo[]) {
    const crateName = this.findChildByType(node, 'identifier');
    if (crateName) {
      const module = this.getNodeText(crateName, content);
      const alias = this.extractExternCrateAlias(node, content);

      imports.push({
        module,
        alias,
        symbols: alias ? [alias] : [module]
      });
    }
  }

  private extractExports(rootNode: any, content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    this.walkAST(rootNode, (node: any) => {
      const startLine = node.startPosition?.row + 1 || 0;

      if (this.hasPublicVisibility(node)) {
        switch (node.type) {
          case 'function_item':
            const funcName = this.getFunctionName(node, content);
            const funcSignature = this.getFunctionSignature(node, content);
            exports.push({
              name: funcName,
              type: 'function',
              line: startLine,
              signature: funcSignature
            });
            break;

          case 'struct_item':
            const structName = this.getStructName(node, content);
            exports.push({
              name: structName,
              type: 'class', // Using 'class' as closest equivalent for struct
              line: startLine,
              signature: `struct ${structName}`
            });
            break;

          case 'enum_item':
            const enumName = this.getEnumName(node, content);
            exports.push({
              name: enumName,
              type: 'type', // Using 'type' for enums
              line: startLine,
              signature: `enum ${enumName}`
            });
            break;

          case 'trait_item':
            const traitName = this.getTraitName(node, content);
            exports.push({
              name: traitName,
              type: 'interface',
              line: startLine,
              signature: `trait ${traitName}`
            });
            break;

          case 'impl_item':
            // Skip impl blocks for exports - they implement methods on types
            break;

          case 'type_item':
            const typeName = this.getTypeName(node, content);
            exports.push({
              name: typeName,
              type: 'type',
              line: startLine,
              signature: this.getTypeSignature(node, content)
            });
            break;

          case 'const_item':
            const constName = this.getConstName(node, content);
            exports.push({
              name: constName,
              type: 'const',
              line: startLine
            });
            break;

          case 'static_item':
            const staticName = this.getStaticName(node, content);
            exports.push({
              name: staticName,
              type: 'var',
              line: startLine
            });
            break;

          case 'mod_item':
            const modName = this.getModuleName(node, content);
            exports.push({
              name: modName,
              type: 'type', // Using 'type' for modules
              line: startLine,
              signature: `mod ${modName}`
            });
            break;
        }
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
        case 'function_item':
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

        case 'struct_item':
          const structSymbol = this.createStructSymbol(node, content, startLine, endLine);
          symbols.push(structSymbol);
          break;

        case 'enum_item':
          const enumSymbol = this.createEnumSymbol(node, content, startLine, endLine);
          symbols.push(enumSymbol);
          break;

        case 'trait_item':
          const traitSymbol = this.createTraitSymbol(node, content, startLine, endLine);
          symbols.push(traitSymbol);
          break;

        case 'impl_item':
          const implSymbol = this.createImplSymbol(node, content, startLine, endLine);
          if (implSymbol) {
            symbols.push(implSymbol);
          }
          break;

        case 'type_item':
          const typeName = this.getTypeName(node, content);
          symbols.push({
            name: typeName,
            kind: SymbolKind.TypeParameter,
            line: startLine,
            column: node.startPosition?.column || 0,
            signature: this.getTypeSignature(node, content)
          });
          break;

        case 'const_item':
          const constName = this.getConstName(node, content);
          symbols.push({
            name: constName,
            kind: SymbolKind.Constant,
            line: startLine,
            column: node.startPosition?.column || 0
          });
          break;

        case 'static_item':
          const staticName = this.getStaticName(node, content);
          symbols.push({
            name: staticName,
            kind: SymbolKind.Variable,
            line: startLine,
            column: node.startPosition?.column || 0
          });
          break;

        case 'mod_item':
          const modName = this.getModuleName(node, content);
          symbols.push({
            name: modName,
            kind: SymbolKind.Module,
            line: startLine,
            column: node.startPosition?.column || 0,
            endLine,
            endColumn: node.endPosition?.column || 0
          });
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
        case 'use_declaration':
          if (outline.find(section => section.title === 'Imports') === undefined) {
            outline.push({
              title: 'Imports',
              level: 1,
              line: startLine
            });
          }
          break;

        case 'function_item':
          const funcName = this.getFunctionName(node, content);
          outline.push({
            title: `Function: ${funcName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'struct_item':
          const structName = this.getStructName(node, content);
          outline.push({
            title: `Struct: ${structName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'enum_item':
          const enumName = this.getEnumName(node, content);
          outline.push({
            title: `Enum: ${enumName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'trait_item':
          const traitName = this.getTraitName(node, content);
          outline.push({
            title: `Trait: ${traitName}`,
            level: 1,
            line: startLine
          });
          break;

        case 'impl_item':
          const implTarget = this.getImplTarget(node, content);
          outline.push({
            title: `Impl: ${implTarget}`,
            level: 1,
            line: startLine
          });
          break;

        case 'mod_item':
          const modName = this.getModuleName(node, content);
          outline.push({
            title: `Module: ${modName}`,
            level: 1,
            line: startLine
          });
          break;
      }
    });

    return outline.sort((a, b) => a.line - b.line);
  }

  // Helper methods for creating complex symbols

  private createStructSymbol(node: any, content: string, startLine: number, endLine: number): SymbolInfo {
    const structName = this.getStructName(node, content);
    const structSymbol: SymbolInfo = {
      name: structName,
      kind: SymbolKind.Struct,
      line: startLine,
      column: node.startPosition?.column || 0,
      endLine,
      endColumn: node.endPosition?.column || 0,
      signature: `struct ${structName}`,
      children: []
    };

    // Extract struct fields
    this.extractStructFields(node, content, structSymbol);

    return structSymbol;
  }

  private createEnumSymbol(node: any, content: string, startLine: number, endLine: number): SymbolInfo {
    const enumName = this.getEnumName(node, content);
    const enumSymbol: SymbolInfo = {
      name: enumName,
      kind: SymbolKind.Enum,
      line: startLine,
      column: node.startPosition?.column || 0,
      endLine,
      endColumn: node.endPosition?.column || 0,
      signature: `enum ${enumName}`,
      children: []
    };

    // Extract enum variants
    this.extractEnumVariants(node, content, enumSymbol);

    return enumSymbol;
  }

  private createTraitSymbol(node: any, content: string, startLine: number, endLine: number): SymbolInfo {
    const traitName = this.getTraitName(node, content);
    const traitSymbol: SymbolInfo = {
      name: traitName,
      kind: SymbolKind.Interface,
      line: startLine,
      column: node.startPosition?.column || 0,
      endLine,
      endColumn: node.endPosition?.column || 0,
      signature: `trait ${traitName}`,
      children: []
    };

    // Extract trait methods
    this.extractTraitMethods(node, content, traitSymbol);

    return traitSymbol;
  }

  private createImplSymbol(node: any, content: string, startLine: number, endLine: number): SymbolInfo | null {
    const implTarget = this.getImplTarget(node, content);
    if (!implTarget) return null;

    const implSymbol: SymbolInfo = {
      name: `impl ${implTarget}`,
      kind: SymbolKind.Class, // Using class as closest equivalent for impl blocks
      line: startLine,
      column: node.startPosition?.column || 0,
      endLine,
      endColumn: node.endPosition?.column || 0,
      signature: `impl ${implTarget}`,
      children: []
    };

    // Extract impl methods
    this.extractImplMethods(node, content, implSymbol);

    return implSymbol;
  }

  private extractStructFields(structNode: any, content: string, parentSymbol: SymbolInfo) {
    this.walkAST(structNode, (node: any) => {
      if (node.type === 'field_declaration') {
        const fieldName = this.getFieldName(node, content);
        const fieldType = this.getFieldType(node, content);
        
        parentSymbol.children!.push({
          name: fieldName,
          kind: SymbolKind.Field,
          line: node.startPosition?.row + 1 || 0,
          column: node.startPosition?.column || 0,
          signature: `${fieldName}: ${fieldType}`,
          parent: parentSymbol.name
        });
      }
    });
  }

  private extractEnumVariants(enumNode: any, content: string, parentSymbol: SymbolInfo) {
    this.walkAST(enumNode, (node: any) => {
      if (node.type === 'enum_variant') {
        const variantName = this.getEnumVariantName(node, content);
        
        parentSymbol.children!.push({
          name: variantName,
          kind: SymbolKind.EnumMember,
          line: node.startPosition?.row + 1 || 0,
          column: node.startPosition?.column || 0,
          parent: parentSymbol.name
        });
      }
    });
  }

  private extractTraitMethods(traitNode: any, content: string, parentSymbol: SymbolInfo) {
    this.walkAST(traitNode, (node: any) => {
      if (node.type === 'function_signature_item' || node.type === 'function_item') {
        const methodName = this.getFunctionName(node, content);
        const methodSignature = this.getFunctionSignature(node, content);
        
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

  private extractImplMethods(implNode: any, content: string, parentSymbol: SymbolInfo) {
    this.walkAST(implNode, (node: any) => {
      if (node.type === 'function_item') {
        const methodName = this.getFunctionName(node, content);
        const methodSignature = this.getFunctionSignature(node, content);
        const methodCalls = this.extractCalls(node, content);
        
        parentSymbol.children!.push({
          name: methodName,
          kind: SymbolKind.Method,
          line: node.startPosition?.row + 1 || 0,
          column: node.startPosition?.column || 0,
          signature: methodSignature,
          parent: parentSymbol.name,
          calls: methodCalls
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
      } else if (child.type === 'macro_invocation') {
        const macroName = this.getMacroName(child, content);
        if (macroName) {
          calls.add(macroName);
        }
      }
    });

    return Array.from(calls).sort();
  }

  // Helper methods for extracting information from specific node types

  private hasPublicVisibility(node: any): boolean {
    return this.findChildByType(node, 'visibility_modifier') !== null;
  }

  private extractModulePath(useClause: any, content: string): string {
    // Extract the full path from use statement
    const pathNode = this.findChildByType(useClause, 'scoped_identifier') || 
                    this.findChildByType(useClause, 'identifier');
    return pathNode ? this.getNodeText(pathNode, content) : '';
  }

  private extractImportSymbols(useClause: any, content: string): string[] {
    const symbols: string[] = [];
    
    // Look for use list (use std::{vec, HashMap})
    const useList = this.findChildByType(useClause, 'use_list');
    if (useList) {
      this.walkAST(useList, (node: any) => {
        if (node.type === 'identifier') {
          symbols.push(this.getNodeText(node, content));
        }
      });
    } else {
      // Single import - extract the last part of the path
      const pathText = this.extractModulePath(useClause, content);
      const parts = pathText.split('::');
      if (parts.length > 0) {
        symbols.push(parts[parts.length - 1]);
      }
    }
    
    return symbols;
  }

  private extractImportAlias(useClause: any, content: string): string | undefined {
    const asClause = this.findChildByType(useClause, 'use_as_clause');
    if (asClause) {
      const identifier = this.findChildByType(asClause, 'identifier');
      return identifier ? this.getNodeText(identifier, content) : undefined;
    }
    return undefined;
  }

  private extractExternCrateAlias(node: any, content: string): string | undefined {
    const asClause = this.findChildByType(node, 'extern_crate_as_clause');
    if (asClause) {
      const identifier = this.findChildByType(asClause, 'identifier');
      return identifier ? this.getNodeText(identifier, content) : undefined;
    }
    return undefined;
  }

  private getFunctionName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getStructName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'type_identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getEnumName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'type_identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getTraitName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'type_identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getTypeName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'type_identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getConstName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getStaticName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getModuleName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getImplTarget(node: any, content: string): string {
    const typeNode = this.findChildByType(node, 'type_identifier') || 
                    this.findChildByType(node, 'generic_type') ||
                    this.findChildByType(node, 'primitive_type');
    return typeNode ? this.getNodeText(typeNode, content) : '';
  }

  private getFieldName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'field_identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getFieldType(node: any, content: string): string {
    // Find the type after the colon
    for (const child of node.children || []) {
      if (child.type !== 'field_identifier' && child.text !== ':') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getEnumVariantName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? this.getNodeText(identifier, content) : '';
  }

  private getFunctionSignature(node: any, content: string): string {
    const name = this.getFunctionName(node, content);
    const params = this.getParameterList(node, content);
    const returnType = this.getReturnType(node, content);
    const generics = this.getGenerics(node, content);
    
    return `fn ${name}${generics}(${params})${returnType}`;
  }

  private getTypeSignature(node: any, content: string): string {
    const name = this.getTypeName(node, content);
    const typeBody = this.getTypeBody(node, content);
    return `type ${name} = ${typeBody}`;
  }

  private getParameterList(node: any, content: string): string {
    const parameters = this.findChildByType(node, 'parameters');
    return parameters ? this.getNodeText(parameters, content) : '';
  }

  private getReturnType(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type === 'return_type') {
        return ` ${this.getNodeText(child, content)}`;
      }
    }
    return '';
  }

  private getGenerics(node: any, content: string): string {
    const typeParameters = this.findChildByType(node, 'type_parameters');
    return typeParameters ? this.getNodeText(typeParameters, content) : '';
  }

  private getTypeBody(node: any, content: string): string {
    for (const child of node.children || []) {
      if (child.type !== 'identifier' && child.type !== 'type_identifier' && 
          child.type !== 'visibility_modifier' && child.text !== 'type' && child.text !== '=') {
        return this.getNodeText(child, content);
      }
    }
    return '';
  }

  private getCallExpressionName(node: any, content: string): string {
    if (node.children && node.children.length > 0) {
      const functionNode = node.children[0];
      if (functionNode.type === 'identifier' || functionNode.type === 'scoped_identifier') {
        return this.getNodeText(functionNode, content);
      } else if (functionNode.type === 'field_expression') {
        return this.getNodeText(functionNode, content);
      }
    }
    return '';
  }

  private getMacroName(node: any, content: string): string {
    const identifier = this.findChildByType(node, 'identifier');
    const name = identifier ? this.getNodeText(identifier, content) : '';
    return name ? `${name}!` : '';
  }

  // Utility methods

  private findChildByType(node: any, type: string): any {
    if (!node || !node.children) return null;
    
    for (const child of node.children) {
      if (child.type === type) {
        return child;
      }
    }
    return null;
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