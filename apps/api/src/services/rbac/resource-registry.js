/**
 * Resource Registry Service
 * 
 * Manages resource types, validates actions, and provides resource schema definitions
 * for the RBAC system.
 */

import { RESOURCE_TYPES, ACTION_HIERARCHY, ERROR_CODES } from './config.js'

export class ResourceRegistry {
  constructor() {
    this.resourceTypes = new Map()
    this.actionHierarchy = ACTION_HIERARCHY
    
    // Initialize with built-in resource types
    this._initializeBuiltInTypes()
  }

  /**
   * Register a new resource type
   */
  registerResourceType(type, definition) {
    if (!type || typeof type !== 'string') {
      throw new Error('Resource type must be a non-empty string')
    }

    if (!definition || typeof definition !== 'object') {
      throw new Error('Resource definition must be an object')
    }

    const normalizedDefinition = {
      type,
      actions: definition.actions || [],
      attributes: definition.attributes || [],
      hierarchical: definition.hierarchical !== false, // Default true
      inheritable: definition.inheritable !== false, // Default true
      schema: definition.schema || {},
      description: definition.description || '',
      validation: definition.validation || {},
      ...definition
    }

    // Validate actions
    if (!Array.isArray(normalizedDefinition.actions)) {
      throw new Error('Actions must be an array')
    }

    // Validate attributes
    if (!Array.isArray(normalizedDefinition.attributes)) {
      throw new Error('Attributes must be an array')
    }

    this.resourceTypes.set(type, normalizedDefinition)
    return normalizedDefinition
  }

  /**
   * Unregister a resource type
   */
  unregisterResourceType(type) {
    if (!this.resourceTypes.has(type)) {
      throw new Error(`Resource type '${type}' not found`)
    }

    // Prevent removal of built-in types
    if (RESOURCE_TYPES[type]) {
      throw new Error(`Cannot unregister built-in resource type '${type}'`)
    }

    return this.resourceTypes.delete(type)
  }

  /**
   * Get resource type definition
   */
  getResourceType(type) {
    return this.resourceTypes.get(type) || null
  }

  /**
   * List all registered resource types
   */
  listResourceTypes() {
    return Array.from(this.resourceTypes.values())
  }

  /**
   * Get available actions for a resource type
   */
  getAvailableActions(resourceType) {
    const definition = this.getResourceType(resourceType)
    if (!definition) {
      throw new Error(`Resource type '${resourceType}' not found`)
    }
    return definition.actions
  }

  /**
   * Validate if an action is available for a resource type
   */
  validateAction(resourceType, action) {
    const availableActions = this.getAvailableActions(resourceType)
    return availableActions.includes(action)
  }

  /**
   * Get all actions that include the specified action through hierarchy
   */
  getImpliedActions(action) {
    const implied = new Set([action])
    
    // Find actions that include this action in their hierarchy
    for (const [higherAction, includedActions] of Object.entries(this.actionHierarchy)) {
      if (includedActions.includes(action)) {
        implied.add(higherAction)
        // Recursively check for higher-level actions
        this.getImpliedActions(higherAction).forEach(a => implied.add(a))
      }
    }
    
    return Array.from(implied)
  }

  /**
   * Get all actions that are included by the specified action
   */
  getIncludedActions(action) {
    const included = new Set([action])
    
    // Add actions included by this action
    if (this.actionHierarchy[action]) {
      this.actionHierarchy[action].forEach(includedAction => {
        included.add(includedAction)
        // Recursively add sub-actions
        this.getIncludedActions(includedAction).forEach(a => included.add(a))
      })
    }
    
    return Array.from(included)
  }

  /**
   * Check if one action includes another through hierarchy
   */
  actionIncludes(parentAction, childAction) {
    if (parentAction === childAction) return true
    
    const includedActions = this.getIncludedActions(parentAction)
    return includedActions.includes(childAction)
  }

  /**
   * Parse resource string (e.g., 'documents:123' or 'tenants:*')
   */
  resolveResource(resourceString) {
    if (!resourceString || typeof resourceString !== 'string') {
      throw new Error('Resource string must be a non-empty string')
    }

    const parts = resourceString.split(':')
    if (parts.length < 1 || parts.length > 2) {
      throw new Error('Invalid resource format. Expected "type" or "type:id"')
    }

    const [type, id = null] = parts
    
    if (!this.resourceTypes.has(type)) {
      throw new Error(`Unknown resource type: ${type}`)
    }

    return {
      type,
      id: id === '*' ? null : id,
      resourceString
    }
  }

  /**
   * Format resource type and ID into resource string
   */
  formatResource(type, id = null) {
    if (!type || typeof type !== 'string') {
      throw new Error('Resource type must be a non-empty string')
    }

    if (!this.resourceTypes.has(type)) {
      throw new Error(`Unknown resource type: ${type}`)
    }

    return id ? `${type}:${id}` : type
  }

  /**
   * Validate a permission against resource type
   */
  validatePermission(resourceType, action) {
    const definition = this.getResourceType(resourceType)
    if (!definition) {
      return {
        valid: false,
        error: `Unknown resource type: ${resourceType}`,
        code: ERROR_CODES.INVALID_RESOURCE
      }
    }

    if (!this.validateAction(resourceType, action)) {
      return {
        valid: false,
        error: `Action '${action}' not available for resource type '${resourceType}'`,
        code: ERROR_CODES.INVALID_ACTION,
        availableActions: definition.actions
      }
    }

    return { valid: true }
  }

  /**
   * Get resource schema for validation
   */
  getResourceSchema(resourceType) {
    const definition = this.getResourceType(resourceType)
    return definition ? definition.schema : null
  }

  /**
   * Get resource attributes for ABAC evaluation
   */
  getResourceAttributes(resourceType) {
    const definition = this.getResourceType(resourceType)
    return definition ? definition.attributes : []
  }

  /**
   * Check if resource type supports hierarchical permissions
   */
  isHierarchical(resourceType) {
    const definition = this.getResourceType(resourceType)
    return definition ? definition.hierarchical : false
  }

  /**
   * Check if resource type supports permission inheritance
   */
  isInheritable(resourceType) {
    const definition = this.getResourceType(resourceType)
    return definition ? definition.inheritable : false
  }

  /**
   * Validate resource permissions for bulk operations
   */
  validateBulkPermissions(permissions) {
    const results = []
    const errors = []

    for (const [index, permission] of permissions.entries()) {
      try {
        const { resource, action } = permission
        const parsed = this.resolveResource(resource)
        const validation = this.validatePermission(parsed.type, action)
        
        if (validation.valid) {
          results.push({
            index,
            resource: parsed,
            action,
            valid: true
          })
        } else {
          errors.push({
            index,
            resource,
            action,
            error: validation.error,
            code: validation.code
          })
        }
      } catch (error) {
        errors.push({
          index,
          resource: permission.resource,
          action: permission.action,
          error: error.message,
          code: ERROR_CODES.INVALID_RESOURCE
        })
      }
    }

    return {
      valid: errors.length === 0,
      results,
      errors,
      totalCount: permissions.length,
      validCount: results.length,
      errorCount: errors.length
    }
  }

  /**
   * Get permission matrix template for a resource type
   */
  getPermissionMatrix(resourceType, includeHierarchy = true) {
    const definition = this.getResourceType(resourceType)
    if (!definition) {
      throw new Error(`Resource type '${resourceType}' not found`)
    }

    const matrix = {}
    
    for (const action of definition.actions) {
      matrix[action] = {
        action,
        description: `Allow ${action} operations on ${resourceType}`,
        includes: includeHierarchy ? this.getIncludedActions(action) : [action]
      }
    }

    return {
      resourceType,
      actions: matrix,
      hierarchical: definition.hierarchical,
      inheritable: definition.inheritable,
      attributes: definition.attributes
    }
  }

  /**
   * Initialize built-in resource types
   */
  _initializeBuiltInTypes() {
    for (const [type, definition] of Object.entries(RESOURCE_TYPES)) {
      this.resourceTypes.set(type, {
        type,
        ...definition,
        builtIn: true
      })
    }
  }

  /**
   * Get resource type statistics
   */
  getStats() {
    const types = this.listResourceTypes()
    const builtInCount = types.filter(t => t.builtIn).length
    const customCount = types.length - builtInCount
    
    const actionCounts = types.reduce((acc, type) => {
      acc[type.type] = type.actions.length
      return acc
    }, {})

    return {
      totalTypes: types.length,
      builtInTypes: builtInCount,
      customTypes: customCount,
      actionCounts,
      hierarchicalTypes: types.filter(t => t.hierarchical).length,
      inheritableTypes: types.filter(t => t.inheritable).length
    }
  }

  /**
   * Health check for resource registry
   */
  healthCheck() {
    try {
      const stats = this.getStats()
      return {
        status: 'healthy',
        resourceTypes: stats.totalTypes,
        builtInTypes: stats.builtInTypes,
        customTypes: stats.customTypes
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      }
    }
  }
}

export default ResourceRegistry