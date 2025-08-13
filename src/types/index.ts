export interface ProjectIndex {
  schemaVersion: string;
  projectRoot: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, FileInfo>;
  symbolIndex: Record<string, string>; // symbol name -> file:line
  dependencyGraph: Record<string, DependencyInfo>;
}

export interface FileInfo {
  path: string;
  language: string;
  size: number;
  hash: string;
  lastIndexedAt: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolInfo[];
  outline: OutlineSection[];
  reactComponents?: ComponentInfo[];
  apiEndpoints?: ApiEndpointInfo[];
}

export interface ImportInfo {
  module: string;
  symbols?: string[];
  isDefault?: boolean;
  alias?: string;
}

export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'let' | 'var' | 'default';
  line: number;
  signature?: string;
}

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  signature?: string;
  docstring?: string;
  children?: SymbolInfo[];
  parent?: string;
}

export enum SymbolKind {
  File = 'file',
  Module = 'module',
  Namespace = 'namespace',
  Package = 'package',
  Class = 'class',
  Method = 'method',
  Property = 'property',
  Field = 'field',
  Constructor = 'constructor',
  Enum = 'enum',
  Interface = 'interface',
  Function = 'function',
  Variable = 'variable',
  Constant = 'constant',
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Array = 'array',
  Object = 'object',
  Key = 'key',
  Null = 'null',
  EnumMember = 'enummember',
  Struct = 'struct',
  Event = 'event',
  Operator = 'operator',
  TypeParameter = 'typeparameter',
  // React-specific symbols
  Component = 'component',
  Hook = 'hook',
  PropsInterface = 'props',
  // API-specific symbols  
  ApiEndpoint = 'endpoint',
  ApiRoute = 'route'
}

export interface OutlineSection {
  type: 'import' | 'export' | 'class' | 'function' | 'interface' | 'type' | 'variable';
  name?: string;
  lines: [number, number]; // [start, end]
}

export interface DependencyInfo {
  imports: string[];
  importedBy: string[];
}

export interface IndexerConfig {
  projectRoot: string;
  indexFile: string;
  excludePatterns: string[];
  includePatterns: string[];
  maxFileSize: number;
  languages: string[];
}

export interface ParseResult {
  imports: ImportInfo[];
  exports: ExportInfo[];
  symbols: SymbolInfo[];
  outline: OutlineSection[];
  reactComponents?: ComponentInfo[];
  apiEndpoints?: ApiEndpointInfo[];
}

// React-specific interfaces
export interface ComponentInfo {
  name: string;
  type: 'functional' | 'class';
  line: number;
  propsType?: string;
  hooks?: string[];
  isExported: boolean;
  displayName?: string;
}

// API-specific interfaces
export interface ApiEndpointInfo {
  method: string;
  path: string;
  handler: string;
  line: number;
  framework?: 'express' | 'koa' | 'fastify' | 'nextjs' | 'nestjs';
  middleware?: string[];
}