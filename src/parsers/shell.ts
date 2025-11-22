import { 
  ParseResult, 
  ImportInfo, 
  ExportInfo, 
  SymbolInfo, 
  OutlineSection,
  SymbolKind
} from '../types';

export interface ShellFunction {
  signature: string;
  doc?: string;
  calls?: string[];
  parameters?: number[];
}

export class ShellParser {
  /**
   * Extract function calls from shell script body
   */
  private extractFunctionCalls(body: string, allFunctions: Set<string>): string[] {
    const calls = new Set<string>();
    
    // In shell, functions are called just by name (no parentheses)
    for (const funcName of allFunctions) {
      const patterns = [
        new RegExp(`^\\s*${funcName}\\b`, 'm'),        // Start of line
        new RegExp(`[;&|]\\s*${funcName}\\b`, 'm'),    // After operators
        new RegExp(`\\$\\(${funcName}\\b`, 'm'),       // Command substitution
        new RegExp(`\`${funcName}\\b`, 'm'),           // Backtick substitution
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(body)) {
          calls.add(funcName);
          break;
        }
      }
    }
    
    return Array.from(calls).sort();
  }

  /**
   * Extract parameters from function body by finding $1, $2, etc. usage
   */
  private extractParameters(lines: string[], startIndex: number): number[] {
    const params: number[] = [];
    let braceCount = 0;
    let inFuncBody = false;
    
    // Look for $1, $2, etc. usage in the function body only
    for (let j = startIndex + 1; j < Math.min(startIndex + 20, lines.length); j++) {
      const lineContent = lines[j].trim();
      
      // Track braces to know when we're in the function
      if (lineContent.includes('{')) {
        braceCount += (lineContent.match(/\{/g) || []).length;
        inFuncBody = true;
      }
      if (lineContent.includes('}')) {
        braceCount -= (lineContent.match(/\}/g) || []).length;
        if (braceCount <= 0) {
          break; // End of function
        }
      }
      
      // Only look for parameters inside the function body
      if (inFuncBody) {
        const paramMatches = lines[j].match(/\$(\d+)/g);
        if (paramMatches) {
          for (const match of paramMatches) {
            const paramNum = parseInt(match.substring(1));
            if (paramNum > 0 && !params.includes(paramNum)) {
              params.push(paramNum);
            }
          }
        }
      }
    }
    
    return params.sort((a, b) => a - b);
  }

  /**
   * Extract function body lines for call analysis
   */
  private extractFunctionBody(lines: string[], startIndex: number): string[] {
    const funcBodyLines: string[] = [];
    let braceCount = 0;
    let inFuncBody = false;
    
    for (let j = startIndex + 1; j < lines.length; j++) {
      const lineContent = lines[j];
      
      if (lineContent.includes('{')) {
        braceCount += (lineContent.match(/\{/g) || []).length;
        inFuncBody = true;
      }
      
      if (inFuncBody) {
        funcBodyLines.push(lineContent);
      }
      
      if (lineContent.includes('}')) {
        braceCount -= (lineContent.match(/\}/g) || []).length;
        if (braceCount <= 0) {
          break;
        }
      }
    }
    
    return funcBodyLines;
  }

  /**
   * Build function signature from parameters
   */
  private buildSignature(funcName: string, params: number[]): string {
    if (params.length === 0) {
      return `function ${funcName}()`;
    }
    
    const maxParam = Math.max(...params);
    const paramList = [];
    for (let j = 1; j <= maxParam; j++) {
      paramList.push(`$${j}`);
    }
    return `function ${funcName}(${paramList.join(' ')})`;
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    
    // First pass: collect all function names
    const allFunctionNames = new Set<string>();
    for (const line of lines) {
      // Style 1: function_name() {
      const match1 = line.match(/^(\w+)\s*\(\)\s*\{?/);
      if (match1) {
        allFunctionNames.add(match1[1]);
      }
      // Style 2: function function_name {
      const match2 = line.match(/^function\s+(\w+)\s*\{?/);
      if (match2) {
        allFunctionNames.add(match2[1]);
      }
    }

    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const symbols: SymbolInfo[] = [];
    const outline: OutlineSection[] = [];
    
    // Function patterns
    const funcPattern1 = /^(\w+)\s*\(\)\s*\{?/;         // function_name() {
    const funcPattern2 = /^function\s+(\w+)\s*\{?/;     // function function_name {
    
    // Variable patterns
    const exportPattern = /^export\s+([A-Z_][A-Z0-9_]*)(=(.*))?/;
    
    // Source patterns - handle quotes and command substitution
    const sourcePatterns = [
      /^(?:source|\.)\s+['"]([^'"]+)['"]/,              // Quoted paths
      /^(?:source|\.)\s+(\$\([^)]+\)[^\s]*)/,          // Command substitution
      /^(?:source|\.)\s+([^\s]+)/,                     // Unquoted paths
    ];

    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim();
      
      // Skip empty lines and pure comments
      if (!stripped || stripped.startsWith('#!')) {
        continue;
      }
      
      // Check for function definition (style 1: function_name())
      let match = stripped.match(funcPattern1);
      if (match) {
        const funcName = match[1];
        
        // Extract documentation comment if present
        let doc: string | undefined;
        if (i > 0 && lines[i-1].trim().startsWith('#')) {
          doc = lines[i-1].trim().substring(1).trim();
        }
        
        // Try to find parameters from the function body
        const params = this.extractParameters(lines, i);
        const signature = this.buildSignature(funcName, params);
        
        // Extract function body for call analysis
        const funcBodyLines = this.extractFunctionBody(lines, i);
        let calls: string[] = [];
        
        if (funcBodyLines.length > 0) {
          const funcBody = funcBodyLines.join('\n');
          calls = this.extractFunctionCalls(funcBody, allFunctionNames);
        }
        
        // Create symbol info
        const symbol: SymbolInfo = {
          name: funcName,
          kind: SymbolKind.Function,
          line: i + 1,
          column: 0,
          signature,
          docstring: doc,
          calls: calls.length > 0 ? calls : undefined
        };
        
        symbols.push(symbol);
        
        // Add to exports (shell functions are generally exported)
        exports.push({
          name: funcName,
          type: 'function',
          line: i + 1,
          signature
        });
        
        continue;
      }
      
      // Check for function definition (style 2: function function_name)
      match = stripped.match(funcPattern2);
      if (match) {
        const funcName = match[1];
        
        // Extract documentation comment if present
        let doc: string | undefined;
        if (i > 0 && lines[i-1].trim().startsWith('#')) {
          doc = lines[i-1].trim().substring(1).trim();
        }
        
        // Try to find parameters from the function body
        const params = this.extractParameters(lines, i);
        const signature = this.buildSignature(funcName, params);
        
        // Extract function body for call analysis
        const funcBodyLines = this.extractFunctionBody(lines, i);
        let calls: string[] = [];
        
        if (funcBodyLines.length > 0) {
          const funcBody = funcBodyLines.join('\n');
          calls = this.extractFunctionCalls(funcBody, allFunctionNames);
        }
        
        // Create symbol info
        const symbol: SymbolInfo = {
          name: funcName,
          kind: SymbolKind.Function,
          line: i + 1,
          column: 0,
          signature,
          docstring: doc,
          calls: calls.length > 0 ? calls : undefined
        };
        
        symbols.push(symbol);
        
        // Add to exports (shell functions are generally exported)
        exports.push({
          name: funcName,
          type: 'function',
          line: i + 1,
          signature
        });
        
        continue;
      }
      
      // Check for exports
      match = stripped.match(exportPattern);
      if (match) {
        const varName = match[1];
        exports.push({
          name: varName,
          type: 'const',
          line: i + 1,
          signature: `export ${varName}`
        });
        continue;
      }
      
      // Check for source/dot includes
      for (const sourcePattern of sourcePatterns) {
        match = stripped.match(sourcePattern);
        if (match) {
          const sourcedFile = match[1].trim();
          if (sourcedFile) {
            imports.push({
              module: sourcedFile
            });
          }
          break;
        }
      }
    }
    
    // Create outline sections
    if (symbols.length > 0) {
      outline.push({
        title: 'Functions',
        level: 1,
        line: 1,
        children: symbols.map(symbol => ({
          title: `${symbol.name}${symbol.signature ? ` - ${symbol.signature}` : ''}`,
          level: 2,
          line: symbol.line
        }))
      });
    }

    return {
      imports,
      exports,
      symbols,
      outline
    };
  }
}