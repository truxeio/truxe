/**
 * Core type definitions for Collections & Workflows feature
 * API Playground Phase 3
 */

import { RequestConfig } from '../lib/request-executor'

// ============================================
// Collection Types
// ============================================

export interface Collection {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
  requests: SavedRequest[]
  folders: Folder[]
  variables?: Record<string, Variable>
  metadata?: CollectionMetadata
  tags?: string[]
}

export interface CollectionMetadata {
  version: string
  author?: string
  tags: string[]
  lastModifiedBy?: string
  requestCount: number
  folderCount: number
}

export interface Folder {
  id: string
  name: string
  description?: string
  parentId?: string
  collectionId: string
  requests: SavedRequest[]
  folders: Folder[]
  createdAt: Date
  updatedAt: Date
  collapsed?: boolean
}

export interface SavedRequest {
  id: string
  name: string
  description?: string
  collectionId: string
  folderId?: string
  config: RequestConfig
  variables?: Record<string, Variable>
  tags: string[]
  createdAt: Date
  updatedAt: Date
  lastExecuted?: Date
  executionCount: number
  response?: SavedResponse
}

export interface SavedResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: any
  data: any
  timestamp: Date
  duration: number
  size: number
  responseTime: number
}

// ============================================
// Variable Types
// ============================================

export interface Variable {
  id: string
  key: string
  value: string
  type: VariableType
  scope: VariableScope
  enabled: boolean
  description?: string
  isSecret?: boolean
  collectionId?: string
  requestId?: string
  createdAt: Date
  updatedAt: Date
}

export type VariableType = 
  | 'environment' 
  | 'collection' 
  | 'request' 
  | 'dynamic'
  | 'secret'

export type VariableScope = 
  | 'global'      // Available everywhere
  | 'collection'  // Available within a collection
  | 'request'     // Available within a specific request
  | 'workflow'    // Available within a workflow execution

export interface VariableContext {
  environment: Record<string, Variable>
  collection: Record<string, Variable>
  request: Record<string, Variable>
  workflow: Record<string, Variable>
  resolved: Record<string, string>
}

export interface DynamicVariable {
  key: string
  generator: () => string
  description: string
  example: string
}

// ============================================
// Workflow Types
// ============================================

export interface Workflow {
  id: string
  name: string
  description: string
  category: WorkflowCategory
  steps: WorkflowStep[]
  variables: Variable[]
  createdAt: Date
  updatedAt: Date
  version: string
  author?: string
  tags: string[]
  isPrebuilt: boolean
}

export type WorkflowCategory = 
  | 'auth' 
  | 'oauth' 
  | 'mfa' 
  | 'session'
  | 'user-management'
  | 'custom'

export interface WorkflowStep {
  id: string
  name: string
  description: string
  order: number
  request: RequestConfig
  expectedResponse?: ExpectedResponse
  extractVariables?: Record<string, string> // JSONPath expressions
  nextStep?: string | ((response: any, variables: VariableContext) => string)
  condition?: StepCondition
  onSuccess?: StepAction[]
  onFailure?: StepAction[]
  timeout?: number
  retries?: number
}

export interface ExpectedResponse {
  status: number | number[]
  schema?: any // JSON Schema for response validation
  headers?: Record<string, string>
  bodyContains?: string[]
  extractFields?: string[] // Fields that must be present
}

export interface StepCondition {
  type: 'variable' | 'response' | 'custom'
  expression: string
  description: string
}

export interface StepAction {
  type: 'set-variable' | 'log' | 'delay' | 'redirect' | 'custom'
  params: Record<string, any>
}

// ============================================
// Execution Types
// ============================================

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  currentStep: number
  totalSteps: number
  startedAt: Date
  completedAt?: Date
  duration?: number
  variables: VariableContext
  steps: StepExecution[]
  stepExecutions: StepExecution[]
  error?: ExecutionError
}

export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface StepExecution {
  stepId: string
  name: string
  status: ExecutionStatus
  startedAt: Date
  completedAt?: Date
  duration?: number
  request?: RequestConfig
  response?: SavedResponse
  extractedVariables?: Record<string, any>
  error?: ExecutionError
  retryCount: number
  success: boolean
}

export interface ExecutionError {
  type: 'network' | 'validation' | 'timeout' | 'script' | 'unknown'
  message: string
  details?: any
  step?: string
  timestamp: Date
}

// ============================================
// Environment Types
// ============================================

export interface Environment {
  id: string
  name: string
  description?: string
  isActive: boolean
  variables: Record<string, Variable>
  baseUrl?: string
  createdAt: Date
  updatedAt: Date
}

// ============================================
// Search & Filter Types
// ============================================

export interface SearchOptions {
  query?: string
  methods?: string[]
  tags?: string[]
  collections?: string[]
  folders?: string[]
  statusCodes?: number[]
  dateRange?: {
    start: Date
    end: Date
  }
  includeResponses?: boolean
  limit?: number
  typeOrder?: ('collection' | 'request' | 'folder' | 'variable' | 'workflow')[]
}

export interface SearchResult {
  id: string
  type: 'collection' | 'request' | 'folder' | 'variable' | 'workflow'
  title: string
  description?: string
  score: number
  data: SavedRequest | Collection | Folder | Variable | Workflow
  highlights?: Array<{ field: string; text: string }> | string[]
  matches: SearchMatch[]
  item: SavedRequest | Collection | Folder | Variable | Workflow
}

export interface SearchMatch {
  field: string
  value: string
  indices: [number, number][]
}

export interface SearchFilters {
  types?: Array<'collection' | 'request' | 'folder' | 'variable' | 'workflow'>
  methods?: string[]
  tags?: string[]
  collectionIds?: string[]
  statusCodes?: number[]
  category?: string
  variableScope?: string
  variableType?: string
  url?: string
}

export interface FilterOptions {
  methods: string[]
  tags: string[]
  collections: string[]
  hasResponse: boolean
  lastExecuted?: 'today' | 'week' | 'month' | 'all'
}

// ============================================
// Import/Export Types
// ============================================

export type ExportFormat = 'truxe' | 'postman' | 'openapi' | 'curl' | 'insomnia'

export interface ExportOptions {
  format: ExportFormat
  includeEnvironments: boolean
  includeVariables: boolean
  includeResponses: boolean
  includeWorkflows?: boolean
  minify?: boolean
}

export interface ImportResult {
  success: boolean
  collections: Collection[]
  environments: Environment[]
  variables: Record<string, Variable>
  workflows?: Workflow[]
  warnings: ImportWarning[]
  errors: ImportError[]
  collectionsImported: number
  requestsImported: number
  variablesImported: number
  workflowsImported: number
}

export interface ImportWarning {
  type: 'unsupported-feature' | 'data-loss' | 'format-conversion'
  message: string
  details?: any
}

export interface ImportError {
  type: 'invalid-format' | 'missing-field' | 'validation-error'
  message: string
  details?: any
  location?: string
}

export interface TruxeExport {
  version: string
  exportType: string
  exportedAt: string
  collections: Collection[]
  variables: Variable[]
  workflows: Workflow[]
  metadata?: {
    totalCollections: number
    totalRequests: number
    totalVariables: number
    totalWorkflows: number
  }
}

// ============================================
// Postman Compatibility Types
// ============================================

export interface PostmanCollection {
  info: {
    name: string
    description?: string
    schema: string
    version?: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
  event?: PostmanEvent[]
}

export interface PostmanItem {
  name: string
  description?: string
  request?: PostmanRequest
  item?: PostmanItem[]
  event?: PostmanEvent[]
}

export interface PostmanRequest {
  method: string
  url: string | PostmanUrl
  header?: PostmanHeader[]
  body?: PostmanBody
  auth?: PostmanAuth
}

export interface PostmanUrl {
  raw: string
  protocol?: string
  host?: string[]
  path?: string[]
  query?: PostmanQuery[]
  variable?: PostmanVariable[]
}

export interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export interface PostmanQuery {
  key: string
  value: string
  disabled?: boolean
  description?: string
}

export interface PostmanBody {
  mode: 'raw' | 'formdata' | 'urlencoded' | 'binary' | 'graphql'
  raw?: string
  formdata?: any[]
  urlencoded?: any[]
  options?: any
}

export interface PostmanAuth {
  type: string
  [key: string]: any
}

export interface PostmanVariable {
  key: string
  value: string
  type?: string
  disabled?: boolean
  description?: string
}

export interface PostmanEvent {
  listen: string
  script: {
    type: string
    exec: string[]
  }
}

// ============================================
// UI State Types
// ============================================

export interface CollectionUIState {
  selectedCollection?: string
  selectedFolder?: string
  selectedRequest?: string
  expandedFolders: Set<string>
  expandedCollections: Set<string>
  searchQuery: string
  filterOptions: FilterOptions
  sortBy: 'name' | 'created' | 'updated' | 'executed'
  sortOrder: 'asc' | 'desc'
  viewMode: 'list' | 'grid' | 'tree'
}

export interface WorkflowUIState {
  selectedWorkflow?: string
  runningExecution?: string
  executionHistory: WorkflowExecution[]
  stepDetailsVisible: boolean
  variablesVisible: boolean
}

// ============================================
// Validation Types
// ============================================

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
  value?: any
}

export interface ValidationWarning {
  field: string
  message: string
  suggestion?: string
}

// ============================================
// Storage Types
// ============================================

export interface StorageMetadata {
  version: string
  createdAt: Date
  lastBackup?: Date
  totalCollections: number
  totalRequests: number
  totalWorkflows: number
  storageSize: number
}

export interface BackupData {
  metadata: StorageMetadata
  collections: Collection[]
  environments: Environment[]
  workflows: Workflow[]
  variables: Record<string, Variable>
  timestamp: Date
}