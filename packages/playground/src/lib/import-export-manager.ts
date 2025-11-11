/**
 * ImportExportManager - Handle import/export of collections and workflows
 * API Playground Phase 3: Collections & Workflows
 */

import {
  Collection,
  Variable,
  Workflow,
  PostmanCollection,
  TruxeExport,
  ImportResult,
  ExportFormat
} from '../types/collections'
import { playgroundStorage } from './storage'
import { collectionManager } from './collection-manager'
import { generateId, sanitizeFilename } from './utils'

export interface ImportOptions {
  mergeStrategy: 'overwrite' | 'merge' | 'skip'
  includeVariables: boolean
  includeWorkflows: boolean
  validateBeforeImport: boolean
}

export interface ExportOptions {
  format: ExportFormat
  includeVariables: boolean
  includeWorkflows: boolean
  minify: boolean
  filename?: string
}

export class ImportExportManager {
  
  /**
   * Export collections to various formats
   */
  async export(
    collectionIds: string[],
    options: ExportOptions = {
      format: 'truxe',
      includeVariables: true,
      includeWorkflows: true,
      minify: false
    }
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    
    try {
      // Load collections and related data
      const collections = await Promise.all(
        collectionIds.map(id => collectionManager.getCollection(id))
      )
      
      const validCollections = collections.filter(c => c !== null) as Collection[]
      
      if (validCollections.length === 0) {
        throw new Error('No valid collections found to export')
      }

      // Load additional data if requested
      let variables: Variable[] = []
      let workflows: Workflow[] = []
      
      if (options.includeVariables) {
        const variablesRecord = await playgroundStorage.loadVariables()
        variables = Object.values(variablesRecord)
      }
      
      if (options.includeWorkflows) {
        workflows = await playgroundStorage.loadWorkflows()
      }

      // Generate export data based on format
      let exportData: any
      let filename: string
      let mimeType: string

      switch (options.format) {
        case 'truxe':
          exportData = this.exportToTruxe(validCollections, variables, workflows)
          filename = options.filename || this.generateFilename('truxe-export', 'json')
          mimeType = 'application/json'
          break
          
        case 'postman':
          exportData = this.exportToPostman(validCollections, variables)
          filename = options.filename || this.generateFilename('postman-collection', 'json')
          mimeType = 'application/json'
          break
          
        case 'openapi':
          exportData = this.exportToOpenAPI(validCollections)
          filename = options.filename || this.generateFilename('openapi-spec', 'json')
          mimeType = 'application/json'
          break
          
        case 'curl':
          exportData = this.exportToCurl(validCollections)
          filename = options.filename || this.generateFilename('api-requests', 'sh')
          mimeType = 'text/plain'
          break
          
        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }

      // Convert to string
      const dataString = typeof exportData === 'string' 
        ? exportData 
        : JSON.stringify(exportData, null, options.minify ? 0 : 2)

      return {
        data: dataString,
        filename,
        mimeType
      }
      
    } catch (error) {
      console.error('Export failed:', error)
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import collections from various formats
   */
  async import(
    data: string,
    format?: ExportFormat,
    options: ImportOptions = {
      mergeStrategy: 'merge',
      includeVariables: true,
      includeWorkflows: true,
      validateBeforeImport: true
    }
  ): Promise<ImportResult> {
    
    try {
      // Auto-detect format if not provided
      const detectedFormat = format || this.detectFormat(data)
      
      if (!detectedFormat) {
        throw new Error('Could not detect import format')
      }

      // Parse data based on format
      let importData: any
      
      switch (detectedFormat) {
        case 'truxe':
          importData = this.parseTruxeImport(data)
          break
          
        case 'postman':
          importData = this.parsePostmanImport(data)
          break
          
        case 'openapi':
          importData = this.parseOpenAPIImport(data)
          break
          
        default:
          throw new Error(`Unsupported import format: ${detectedFormat}`)
      }

      // Validate if requested
      if (options.validateBeforeImport) {
        const validation = this.validateImportData(importData, detectedFormat)
        if (!validation.valid) {
          throw new Error(`Import validation failed: ${validation.errors.join(', ')}`)
        }
      }

      // Process import
      const result = await this.processImport(importData, detectedFormat, options)
      
      return {
        success: true,
        collections: [],
        environments: [],
        variables: {},
        workflows: [],
        warnings: [],
        errors: result.errors.map(msg => ({ type: 'validation-error' as const, message: msg, details: {} })),
        collectionsImported: result.collectionsImported,
        requestsImported: result.requestsImported,
        variablesImported: result.variablesImported,
        workflowsImported: result.workflowsImported
      }
      
    } catch (error) {
      console.error('Import failed:', error)
      return {
        success: false,
        collections: [],
        environments: [],
        variables: {},
        workflows: [],
        warnings: [],
        errors: [{ type: 'validation-error' as const, message: error instanceof Error ? error.message : 'Unknown error', details: {} }],
        collectionsImported: 0,
        requestsImported: 0,
        variablesImported: 0,
        workflowsImported: 0
      }
    }
  }

  /**
   * Auto-detect import format
   */
  detectFormat(data: string): ExportFormat | null {
    try {
      const parsed = JSON.parse(data)
      
      // Check for Truxe format
      if (parsed.version && parsed.exportType === 'truxe' && parsed.collections) {
        return 'truxe'
      }
      
      // Check for Postman format
      if (parsed.info && (parsed.info.schema || parsed.info._postman_id)) {
        return 'postman'
      }
      
      // Check for OpenAPI format
      if (parsed.openapi || parsed.swagger) {
        return 'openapi'
      }
      
      return null
      
    } catch {
      // Check for cURL format (plain text)
      if (data.includes('curl ') || data.includes('#!/bin/bash')) {
        return 'curl'
      }
      
      return null
    }
  }

  /**
   * Export to Truxe format
   */
  private exportToTruxe(
    collections: Collection[], 
    variables: Variable[], 
    workflows: Workflow[]
  ): TruxeExport {
    return {
      version: '1.0.0',
      exportType: 'truxe',
      exportedAt: new Date().toISOString(),
      collections,
      variables,
      workflows,
      metadata: {
        totalCollections: collections.length,
        totalRequests: collections.reduce((sum, c) => sum + c.requests.length, 0),
        totalVariables: variables.length,
        totalWorkflows: workflows.length
      }
    }
  }

  /**
   * Export to Postman format
   */
  private exportToPostman(collections: Collection[], variables: Variable[]): PostmanCollection {
    if (collections.length !== 1) {
      throw new Error('Postman export supports only one collection at a time')
    }

    const collection = collections[0]

    return {
      info: {
        name: collection.name,
        description: collection.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [], // Would need to convert saved requests to Postman items
      variable: variables
        .filter(v => v.scope === 'collection')
        .map(v => ({
          key: v.key,
          value: String(v.value),
          type: v.type === 'secret' ? 'secret' : 'default'
        }))
    }
  }

  /**
   * Export to OpenAPI format
   */
  private exportToOpenAPI(collections: Collection[]): any {
    const collection = collections[0]
    
    return {
      openapi: '3.0.3',
      info: {
        title: collection.name,
        description: collection.description,
        version: '1.0.0'
      },
      servers: [],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {}
      }
    }
  }

  /**
   * Export to cURL format
   */
  private exportToCurl(collections: Collection[]): string {
    const curlCommands: string[] = [
      '#!/bin/bash',
      '# Generated API requests from Truxe Playground',
      `# Exported on ${new Date().toISOString()}`,
      ''
    ]
    
    collections.forEach(collection => {
      curlCommands.push(`# Collection: ${collection.name}`)
      if (collection.description) {
        curlCommands.push(`# ${collection.description}`)
      }
      curlCommands.push('')
      
      // Would need to load and convert saved requests to cURL
      // This is a placeholder implementation
      curlCommands.push('# TODO: Convert saved requests to cURL commands')
      curlCommands.push('')
    })
    
    return curlCommands.join('\n')
  }

  /**
   * Parse Truxe import data
   */
  private parseTruxeImport(data: string): TruxeExport {
    const parsed = JSON.parse(data)
    
    // Convert date strings back to Date objects
    if (parsed.collections) {
      parsed.collections = parsed.collections.map((collection: any) => ({
        ...collection,
        createdAt: new Date(collection.createdAt),
        updatedAt: new Date(collection.updatedAt)
      }))
    }
    
    if (parsed.variables) {
      parsed.variables = parsed.variables.map((variable: any) => ({
        ...variable,
        createdAt: new Date(variable.createdAt),
        updatedAt: new Date(variable.updatedAt)
      }))
    }
    
    if (parsed.workflows) {
      parsed.workflows = parsed.workflows.map((workflow: any) => ({
        ...workflow,
        createdAt: new Date(workflow.createdAt),
        updatedAt: new Date(workflow.updatedAt)
      }))
    }
    
    return parsed
  }

  /**
   * Parse Postman import data
   */
  private parsePostmanImport(data: string): any {
    const parsed = JSON.parse(data)
    
    // Convert Postman collection to Truxe format
    const collection: Collection = {
      id: parsed.info._postman_id || generateId(),
      name: parsed.info.name,
      description: parsed.info.description || '',
      requests: [],
      folders: [],
      variables: {},
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    // Convert variables
    const variables: Variable[] = (parsed.variable || []).map((v: any) => ({
      id: generateId(),
      key: v.key,
      value: v.value,
      type: v.type === 'secret' ? 'secret' : 'environment',
      scope: 'collection',
      description: '',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
    
    return {
      collections: [collection],
      variables,
      requests: [], // Would need to convert Postman items
      folders: [],
      workflows: []
    }
  }

  /**
   * Parse OpenAPI import data
   */
  private parseOpenAPIImport(data: string): any {
    const parsed = JSON.parse(data)
    
    // Convert OpenAPI spec to Truxe format
    const collection: Collection = {
      id: generateId(),
      name: parsed.info.title,
      description: parsed.info.description || '',
      requests: [],
      folders: [],
      variables: {},
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    return {
      collections: [collection],
      variables: [],
      requests: [], // Would need to convert paths to requests
      folders: [],
      workflows: []
    }
  }

  /**
   * Validate import data
   */
  private validateImportData(
    data: any, 
    format: ExportFormat
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    switch (format) {
      case 'truxe':
        if (!data.collections || !Array.isArray(data.collections)) {
          errors.push('Collections array is required')
        }
        break
        
      case 'postman':
        if (!data.info || !data.info.name) {
          errors.push('Postman collection info is required')
        }
        break
        
      case 'openapi':
        if (!data.info || !data.info.title) {
          errors.push('OpenAPI info is required')
        }
        break
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Process import data
   */
  private async processImport(
    data: any,
    _format: ExportFormat,
    options: ImportOptions
  ): Promise<{
    collectionsImported: number
    requestsImported: number
    variablesImported: number
    workflowsImported: number
    errors: string[]
  }> {
    
    const result = {
      collectionsImported: 0,
      requestsImported: 0,
      variablesImported: 0,
      workflowsImported: 0,
      errors: [] as string[]
    }
    
    try {
      // Import collections
      if (data.collections) {
        for (const collection of data.collections) {
          try {
            await this.importCollection(collection, options.mergeStrategy)
            result.collectionsImported++
          } catch (error) {
            result.errors.push(`Failed to import collection ${collection.name}: ${error}`)
          }
        }
      }
      
      // Import variables
      if (options.includeVariables && data.variables) {
        for (const variable of data.variables) {
          try {
            await this.importVariable(variable, options.mergeStrategy)
            result.variablesImported++
          } catch (error) {
            result.errors.push(`Failed to import variable ${variable.key}: ${error}`)
          }
        }
      }
      
      // Import workflows
      if (options.includeWorkflows && data.workflows) {
        for (const workflow of data.workflows) {
          try {
            await this.importWorkflow(workflow, options.mergeStrategy)
            result.workflowsImported++
          } catch (error) {
            result.errors.push(`Failed to import workflow ${workflow.name}: ${error}`)
          }
        }
      }
      
    } catch (error) {
      result.errors.push(`Import processing failed: ${error}`)
    }
    
    return result
  }

  /**
   * Import single collection
   */
  private async importCollection(collection: Collection, mergeStrategy: string): Promise<void> {
    const existing = await collectionManager.getCollection(collection.id)
    
    if (existing && mergeStrategy === 'skip') {
      return
    }
    
    if (existing && mergeStrategy === 'merge') {
      // Merge collections - combine unique requests, folders, etc.
      await collectionManager.updateCollection(collection.id, {
        name: collection.name,
        description: collection.description
      })
    } else {
      // Overwrite or create new
      await collectionManager.createCollection(collection.name, collection.description, collection.variables)
    }
  }

  /**
   * Import single variable
   */
  private async importVariable(variable: Variable, mergeStrategy: string): Promise<void> {
    const variables = await playgroundStorage.loadVariables()
    const existing = variables[variable.key]

    if (existing && mergeStrategy === 'skip') {
      return
    }

    await playgroundStorage.saveVariables({ [variable.key]: variable })
  }

  /**
   * Import single workflow
   */
  private async importWorkflow(workflow: Workflow, mergeStrategy: string): Promise<void> {
    const workflows = await playgroundStorage.loadWorkflows()
    const existing = workflows.find(w => w.id === workflow.id)

    if (existing && mergeStrategy === 'skip') {
      return
    }

    await playgroundStorage.saveWorkflow(workflow)
  }

  /**
   * Generate filename for export
   */
  private generateFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().split('T')[0]
    return sanitizeFilename(`${prefix}-${timestamp}.${extension}`)
  }

  /**
   * Get supported import formats
   */
  getSupportedImportFormats(): ExportFormat[] {
    return ['truxe', 'postman', 'openapi']
  }

  /**
   * Get supported export formats
   */
  getSupportedExportFormats(): ExportFormat[] {
    return ['truxe', 'postman', 'openapi', 'curl']
  }

  /**
   * Validate file before import
   */
  validateFile(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (file.size > maxSize) {
      errors.push('File size exceeds 10MB limit')
    }
    
    const allowedTypes = [
      'application/json',
      'text/json',
      'text/plain'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      errors.push('Invalid file type. Please use JSON or text files.')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Export singleton instance
export const importExportManager = new ImportExportManager()