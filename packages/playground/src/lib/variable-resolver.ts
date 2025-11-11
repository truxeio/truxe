/**
 * VariableResolver - Template variable resolution and substitution
 * API Playground Phase 3: Collections & Workflows
 */

import {
  Variable,
  VariableContext,
  VariableType,
  DynamicVariable,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types/collections'
import { generateUUID } from './utils'

export class VariableResolver {
  private dynamicVariables: Map<string, DynamicVariable> = new Map()

  constructor() {
    this.initializeDynamicVariables()
  }

  /**
   * Initialize built-in dynamic variables
   */
  private initializeDynamicVariables(): void {
    const dynamicVars: DynamicVariable[] = [
      {
        key: '$timestamp',
        generator: () => Date.now().toString(),
        description: 'Current timestamp in milliseconds',
        example: '1699632000000'
      },
      {
        key: '$isoTimestamp',
        generator: () => new Date().toISOString(),
        description: 'Current timestamp in ISO 8601 format',
        example: '2023-11-10T12:00:00.000Z'
      },
      {
        key: '$uuid',
        generator: () => generateUUID(),
        description: 'Random UUID v4',
        example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      },
      {
        key: '$randomInt',
        generator: () => Math.floor(Math.random() * 1000000).toString(),
        description: 'Random integer between 0 and 999999',
        example: '742836'
      },
      {
        key: '$randomString',
        generator: () => Math.random().toString(36).substring(2, 12),
        description: 'Random string (10 characters)',
        example: 'x7k9m2n4p8'
      },
      {
        key: '$randomEmail',
        generator: () => {
          const username = Math.random().toString(36).substring(2, 8)
          const domains = ['example.com', 'test.org', 'demo.net', 'sample.io']
          const domain = domains[Math.floor(Math.random() * domains.length)]
          return `${username}@${domain}`
        },
        description: 'Random email address',
        example: 'user123@example.com'
      },
      {
        key: '$randomName',
        generator: () => {
          const firstNames = ['Alex', 'Sam', 'Jordan', 'Casey', 'Morgan', 'Taylor']
          const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia']
          const first = firstNames[Math.floor(Math.random() * firstNames.length)]
          const last = lastNames[Math.floor(Math.random() * lastNames.length)]
          return `${first} ${last}`
        },
        description: 'Random full name',
        example: 'Alex Smith'
      },
      {
        key: '$randomPhone',
        generator: () => {
          const area = Math.floor(Math.random() * 900) + 100
          const exchange = Math.floor(Math.random() * 900) + 100
          const number = Math.floor(Math.random() * 9000) + 1000
          return `+1-${area}-${exchange}-${number}`
        },
        description: 'Random US phone number',
        example: '+1-555-123-4567'
      },
      {
        key: '$randomBoolean',
        generator: () => Math.random() < 0.5 ? 'true' : 'false',
        description: 'Random boolean value',
        example: 'true'
      },
      {
        key: '$randomFloat',
        generator: () => (Math.random() * 100).toFixed(2),
        description: 'Random float between 0 and 100 (2 decimal places)',
        example: '42.73'
      },
      {
        key: '$randomDate',
        generator: () => {
          const start = new Date(2020, 0, 1)
          const end = new Date()
          const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime())
          return new Date(randomTime).toISOString().split('T')[0]
        },
        description: 'Random date between 2020-01-01 and today',
        example: '2023-06-15'
      },
      {
        key: '$randomColor',
        generator: () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        description: 'Random hex color code',
        example: '#ff5733'
      }
    ]

    dynamicVars.forEach(variable => {
      this.dynamicVariables.set(variable.key, variable)
    })
  }

  /**
   * Resolve template string with variables from context
   */
  resolve(template: string, context: VariableContext): string {
    if (!template || typeof template !== 'string') {
      return template
    }

    // Find all variable references in the template
    const variableRegex = /\{\{([^}]+)\}\}/g
    let resolved = template
    let match

    while ((match = variableRegex.exec(template)) !== null) {
      const fullMatch = match[0] // {{variableName}}
      const variableName = match[1].trim() // variableName

      try {
        const value = this.resolveVariable(variableName, context)
        resolved = resolved.replace(fullMatch, value)
      } catch (error) {
        console.warn(`Failed to resolve variable "${variableName}":`, error)
        // Leave the variable placeholder if resolution fails
      }
    }

    return resolved
  }

  /**
   * Resolve a single variable by name
   */
  private resolveVariable(variableName: string, context: VariableContext): string {
    // Check if it's a dynamic variable
    if (variableName.startsWith('$')) {
      const dynamicVar = this.dynamicVariables.get(variableName)
      if (dynamicVar) {
        return dynamicVar.generator()
      }
      throw new Error(`Unknown dynamic variable: ${variableName}`)
    }

    // Check resolved context first (highest priority)
    if (context.resolved && variableName in context.resolved) {
      return context.resolved[variableName]
    }

    // Check workflow context (workflow execution variables)
    if (context.workflow && variableName in context.workflow) {
      const variable = context.workflow[variableName]
      if (variable.enabled) {
        return variable.value
      }
    }

    // Check request context (request-specific variables)
    if (context.request && variableName in context.request) {
      const variable = context.request[variableName]
      if (variable.enabled) {
        return variable.value
      }
    }

    // Check collection context (collection-scoped variables)
    if (context.collection && variableName in context.collection) {
      const variable = context.collection[variableName]
      if (variable.enabled) {
        return variable.value
      }
    }

    // Check environment context (global variables)
    if (context.environment && variableName in context.environment) {
      const variable = context.environment[variableName]
      if (variable.enabled) {
        return variable.value
      }
    }

    throw new Error(`Variable "${variableName}" not found in any context`)
  }

  /**
   * Validate template string for proper variable syntax
   */
  validateTemplate(template: string): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!template || typeof template !== 'string') {
      return { valid: true, errors, warnings }
    }

    // Check for malformed variable syntax
    const malformedRegex = /\{[^{}]*\{|\}[^{}]*\}/g
    let match

    while ((match = malformedRegex.exec(template)) !== null) {
      errors.push({
        field: 'template',
        message: `Malformed variable syntax at position ${match.index}: "${match[0]}"`,
        code: 'MALFORMED_SYNTAX',
        value: match[0]
      })
    }

    // Check for unclosed variables
    const openBraces = (template.match(/\{\{/g) || []).length
    const closeBraces = (template.match(/\}\}/g) || []).length

    if (openBraces !== closeBraces) {
      errors.push({
        field: 'template',
        message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
        code: 'MISMATCHED_BRACES',
        value: template
      })
    }

    // Check for empty variable names
    const emptyVariables = template.match(/\{\{\s*\}\}/g)
    if (emptyVariables) {
      errors.push({
        field: 'template',
        message: 'Empty variable name found',
        code: 'EMPTY_VARIABLE',
        value: emptyVariables[0]
      })
    }

    // Check for nested variables (not supported)
    const nestedRegex = /\{\{[^{}]*\{\{[^{}]*\}\}[^{}]*\}\}/g
    const nestedMatches = template.match(nestedRegex)
    if (nestedMatches) {
      warnings.push({
        field: 'template',
        message: 'Nested variables are not supported',
        suggestion: 'Use separate variables instead of nesting'
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Extract all variable names from a template
   */
  extractVariables(template: string): string[] {
    if (!template || typeof template !== 'string') {
      return []
    }

    const variableRegex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = variableRegex.exec(template)) !== null) {
      const variableName = match[1].trim()
      if (variableName && !variables.includes(variableName)) {
        variables.push(variableName)
      }
    }

    return variables
  }

  /**
   * Get all available dynamic variables
   */
  getDynamicVariables(): DynamicVariable[] {
    return Array.from(this.dynamicVariables.values())
  }

  /**
   * Add a custom dynamic variable
   */
  addDynamicVariable(variable: DynamicVariable): void {
    if (!variable.key.startsWith('$')) {
      throw new Error('Dynamic variable keys must start with $')
    }

    this.dynamicVariables.set(variable.key, variable)
  }

  /**
   * Remove a dynamic variable
   */
  removeDynamicVariable(key: string): boolean {
    return this.dynamicVariables.delete(key)
  }

  /**
   * Create a variable context from different sources
   */
  createContext(options: {
    environment?: Record<string, Variable>
    collection?: Record<string, Variable>
    request?: Record<string, Variable>
    workflow?: Record<string, Variable>
    resolved?: Record<string, string>
  }): VariableContext {
    return {
      environment: options.environment || {},
      collection: options.collection || {},
      request: options.request || {},
      workflow: options.workflow || {},
      resolved: options.resolved || {}
    }
  }

  /**
   * Resolve all templates in an object recursively
   */
  resolveObject<T>(obj: T, context: VariableContext): T {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (typeof obj === 'string') {
      return this.resolve(obj, context) as unknown as T
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObject(item, context)) as unknown as T
    }

    if (typeof obj === 'object') {
      const resolved = {} as any
      Object.keys(obj).forEach(key => {
        resolved[key] = this.resolveObject((obj as any)[key], context)
      })
      return resolved
    }

    return obj
  }

  /**
   * Check if a template contains any variables
   */
  containsVariables(template: string): boolean {
    if (!template || typeof template !== 'string') {
      return false
    }

    return /\{\{[^}]+\}\}/.test(template)
  }

  /**
   * Preview variable resolution (show what would be resolved without dynamic values)
   */
  previewResolution(
    template: string, 
    context: VariableContext
  ): { resolved: string; variables: Array<{ name: string; value: string; source: string }> } {
    const variables: Array<{ name: string; value: string; source: string }> = []
    const variableRegex = /\{\{([^}]+)\}\}/g
    let resolved = template
    let match

    while ((match = variableRegex.exec(template)) !== null) {
      const fullMatch = match[0]
      const variableName = match[1].trim()

      try {
        let value: string
        let source: string

        if (variableName.startsWith('$')) {
          const dynamicVar = this.dynamicVariables.get(variableName)
          if (dynamicVar) {
            value = `[Dynamic: ${dynamicVar.description}]`
            source = 'dynamic'
          } else {
            value = '[Unknown dynamic variable]'
            source = 'unknown'
          }
        } else {
          // Check contexts in order of precedence
          if (context.resolved && variableName in context.resolved) {
            value = context.resolved[variableName]
            source = 'resolved'
          } else if (context.workflow && variableName in context.workflow) {
            value = context.workflow[variableName].enabled 
              ? context.workflow[variableName].value 
              : '[Disabled]'
            source = 'workflow'
          } else if (context.request && variableName in context.request) {
            value = context.request[variableName].enabled 
              ? context.request[variableName].value 
              : '[Disabled]'
            source = 'request'
          } else if (context.collection && variableName in context.collection) {
            value = context.collection[variableName].enabled 
              ? context.collection[variableName].value 
              : '[Disabled]'
            source = 'collection'
          } else if (context.environment && variableName in context.environment) {
            value = context.environment[variableName].enabled 
              ? context.environment[variableName].value 
              : '[Disabled]'
            source = 'environment'
          } else {
            value = '[Not found]'
            source = 'unknown'
          }
        }

        variables.push({ name: variableName, value, source })
        resolved = resolved.replace(fullMatch, value)
      } catch (error) {
        variables.push({ 
          name: variableName, 
          value: '[Error]', 
          source: 'error' 
        })
      }
    }

    return { resolved, variables }
  }

  /**
   * Create a variable with validation
   */
  createVariable(
    key: string,
    value: string,
    type: VariableType = 'environment',
    options: Partial<Omit<Variable, 'key' | 'value' | 'type' | 'createdAt' | 'updatedAt'>> = {}
  ): Variable {
    const validation = this.validateVariableKey(key)
    if (!validation.valid) {
      throw new Error(validation.errors[0].message)
    }

    return {
      id: generateUUID(),
      key,
      value,
      type,
      scope: options.scope || 'global',
      enabled: options.enabled !== false,
      description: options.description,
      isSecret: options.isSecret || false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * Validate variable key
   */
  private validateVariableKey(key: string): ValidationResult {
    const errors: ValidationError[] = []

    if (!key || key.trim().length === 0) {
      errors.push({
        field: 'key',
        message: 'Variable key is required',
        code: 'REQUIRED',
        value: key
      })
    }

    // Check for valid characters (alphanumeric, underscore, dot, dash)
    if (key && !/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(key)) {
      errors.push({
        field: 'key',
        message: 'Variable key can only contain letters, numbers, underscore, dot, and dash. Must start with letter or underscore.',
        code: 'INVALID_CHARACTERS',
        value: key
      })
    }

    // Check length
    if (key && key.length > 100) {
      errors.push({
        field: 'key',
        message: 'Variable key must be 100 characters or less',
        code: 'MAX_LENGTH',
        value: key
      })
    }

    // Check for reserved dynamic variable prefix
    if (key && key.startsWith('$') && !this.dynamicVariables.has(key)) {
      errors.push({
        field: 'key',
        message: 'Variables starting with $ are reserved for dynamic variables',
        code: 'RESERVED_PREFIX',
        value: key
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    }
  }
}

// Export singleton instance
export const variableResolver = new VariableResolver()