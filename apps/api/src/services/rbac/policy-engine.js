/**
 * ABAC Policy Engine
 * 
 * Attribute-Based Access Control policy evaluation engine with support for
 * complex conditions, time-based policies, IP restrictions, and custom attributes.
 */

import { CONDITION_OPERATORS, RBAC_CONFIG, ERROR_CODES, AUDIT_EVENTS } from './config.js'

export class PolicyEngine {
  constructor(database, auditLogger, cache = null) {
    this.db = database
    this.auditLogger = auditLogger
    this.cache = cache
    this.operators = CONDITION_OPERATORS
    this.cachePrefix = 'rbac:policy:'
    this.cacheTTL = 300 // 5 minutes
    this.evaluationTimeout = RBAC_CONFIG.POLICY_EVALUATION_TIMEOUT
  }

  // ===================================================================
  // POLICY EVALUATION
  // ===================================================================

  /**
   * Evaluate a policy against context
   */
  async evaluatePolicy(policy, context) {
    const startTime = Date.now()
    
    try {
      // Validate policy structure
      if (!this._validatePolicyStructure(policy)) {
        throw new Error('Invalid policy structure')
      }

      // Check if evaluation should timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Policy evaluation timeout')), this.evaluationTimeout)
      })

      // Evaluate policy with timeout
      const evaluationPromise = this._evaluatePolicyInternal(policy, context)
      const result = await Promise.race([evaluationPromise, timeoutPromise])

      const evaluationTime = Date.now() - startTime

      return {
        allowed: result.allowed,
        effect: policy.effect,
        policy: {
          id: policy.id,
          name: policy.name,
          priority: policy.priority
        },
        conditions: result.conditions,
        evaluationTime,
        metadata: {
          ...result.metadata,
          evaluatedAt: new Date(),
          contextKeys: Object.keys(context)
        }
      }
    } catch (error) {
      const evaluationTime = Date.now() - startTime
      
      return {
        allowed: false,
        effect: 'deny',
        error: error.message,
        evaluationTime,
        metadata: {
          evaluatedAt: new Date(),
          failed: true
        }
      }
    }
  }

  /**
   * Evaluate permission with policy conditions
   */
  async evaluatePermission(permission, context) {
    if (!permission.conditions || Object.keys(permission.conditions).length === 0) {
      return { allowed: true, reason: 'No conditions to evaluate' }
    }

    try {
      const result = await this.evaluateConditions(permission.conditions, context)
      return {
        allowed: result.allowed,
        reason: result.reason,
        evaluatedConditions: result.evaluatedConditions,
        permission: {
          id: permission.id,
          resourceType: permission.resourceType,
          actions: permission.actions
        }
      }
    } catch (error) {
      return {
        allowed: false,
        reason: `Condition evaluation failed: ${error.message}`,
        error: error.message
      }
    }
  }

  /**
   * Evaluate ABAC conditions
   */
  async evaluateConditions(conditions, context) {
    if (!conditions || typeof conditions !== 'object') {
      return { allowed: true, reason: 'No conditions provided' }
    }

    const evaluatedConditions = {}
    const failedConditions = []

    try {
      for (const [conditionType, conditionValue] of Object.entries(conditions)) {
        const result = await this._evaluateCondition(conditionType, conditionValue, context)
        evaluatedConditions[conditionType] = result

        if (!result.allowed) {
          failedConditions.push({
            type: conditionType,
            expected: conditionValue,
            actual: result.actual,
            reason: result.reason
          })
        }
      }

      const allowed = failedConditions.length === 0
      
      return {
        allowed,
        reason: allowed ? 'All conditions satisfied' : `Failed conditions: ${failedConditions.map(f => f.type).join(', ')}`,
        evaluatedConditions,
        failedConditions: allowed ? [] : failedConditions
      }
    } catch (error) {
      return {
        allowed: false,
        reason: `Condition evaluation error: ${error.message}`,
        error: error.message,
        evaluatedConditions
      }
    }
  }

  // ===================================================================
  // POLICY MANAGEMENT
  // ===================================================================

  /**
   * Create a new policy
   */
  async createPolicy(policyDefinition, createdBy) {
    const {
      name,
      tenantId,
      effect = 'allow',
      resources = [],
      actions = [],
      conditions = {},
      priority = 100
    } = policyDefinition

    // Validate policy
    const validation = this.validatePolicy(policyDefinition)
    if (!validation.valid) {
      throw new Error(`Invalid policy: ${validation.errors.join(', ')}`)
    }

    try {
      // NOTE: policies table does NOT have a description column
      // BEST PRACTICE: resources and actions are text[] (PostgreSQL arrays), send as JS arrays directly
      const result = await this.db.query(`
        INSERT INTO policies (
          tenant_id, name, effect, resources, actions,
          conditions, priority, created_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *
      `, [
        tenantId, name, effect,
        resources, actions,  // Send as arrays, not JSON strings
        JSON.stringify(conditions), priority, createdBy
      ])

      const policy = this._mapPolicyRow(result.rows[0])

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.POLICY_CREATED,
        orgId: tenantId,
        actorUserId: createdBy,
        targetType: 'policy',
        targetId: policy.id,
        details: { policyName: name, effect, resources, actions },
        category: 'rbac'
      })

      // Clear tenant policy cache
      await this._clearTenantPolicyCache(tenantId)

      return policy
    } catch (error) {
      if (error.code === '23505') { // Unique constraint
        throw new Error(`Policy '${name}' already exists for this tenant`)
      }
      throw new Error(`Failed to create policy: ${error.message}`)
    }
  }

  /**
   * Update a policy
   */
  async updatePolicy(policyId, updates, updatedBy) {
    const existingPolicy = await this.getPolicy(policyId)
    if (!existingPolicy) {
      throw new Error(`Policy not found: ${policyId}`)
    }

    // NOTE: description column does not exist in policies table
    const allowedFields = ['effect', 'resources', 'actions', 'conditions', 'priority', 'enabled']
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {})

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update')
    }

    // Validate updated policy
    const updatedPolicyDef = { ...existingPolicy, ...filteredUpdates }
    const validation = this.validatePolicy(updatedPolicyDef)
    if (!validation.valid) {
      throw new Error(`Invalid policy update: ${validation.errors.join(', ')}`)
    }

    const setClauses = []
    const values = [policyId]
    let paramIndex = 2

    for (const [field, value] of Object.entries(filteredUpdates)) {
      // BEST PRACTICE: Only stringify conditions (JSONB), not resources/actions (text[])
      if (field === 'conditions') {
        setClauses.push(`${field} = $${paramIndex}`)
        values.push(JSON.stringify(value))
      } else if (['resources', 'actions'].includes(field)) {
        // resources and actions are PostgreSQL arrays, send as JS arrays
        setClauses.push(`${field} = $${paramIndex}`)
        values.push(value)  // Send as array, not JSON string
      } else {
        setClauses.push(`${field} = $${paramIndex}`)
        values.push(value)
      }
      paramIndex++
    }

    setClauses.push('updated_at = NOW()')

    try {
      const result = await this.db.query(`
        UPDATE policies 
        SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *
      `, values)

      const updatedPolicy = this._mapPolicyRow(result.rows[0])

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.POLICY_UPDATED,
        orgId: updatedPolicy.tenantId,
        actorUserId: updatedBy,
        targetType: 'policy',
        targetId: policyId,
        details: { updates: filteredUpdates },
        category: 'rbac'
      })

      // Clear caches
      await this._clearTenantPolicyCache(updatedPolicy.tenantId)
      await this._clearPolicyCache(policyId)

      return updatedPolicy
    } catch (error) {
      throw new Error(`Failed to update policy: ${error.message}`)
    }
  }

  /**
   * Delete a policy
   */
  async deletePolicy(policyId, deletedBy) {
    const existingPolicy = await this.getPolicy(policyId)
    if (!existingPolicy) {
      throw new Error(`Policy not found: ${policyId}`)
    }

    try {
      const result = await this.db.query(`
        DELETE FROM policies WHERE id = $1 RETURNING *
      `, [policyId])

      // Log audit event
      await this.auditLogger.logEvent({
        action: AUDIT_EVENTS.POLICY_DELETED,
        orgId: existingPolicy.tenantId,
        actorUserId: deletedBy,
        targetType: 'policy',
        targetId: policyId,
        details: { policyName: existingPolicy.name },
        category: 'rbac'
      })

      // Clear caches
      await this._clearTenantPolicyCache(existingPolicy.tenantId)
      await this._clearPolicyCache(policyId)

      return this._mapPolicyRow(result.rows[0])
    } catch (error) {
      throw new Error(`Failed to delete policy: ${error.message}`)
    }
  }

  /**
   * Get a policy by ID
   */
  async getPolicy(policyId) {
    const cacheKey = `${this.cachePrefix}${policyId}`
    
    if (this.cache) {
      const cached = await this.cache.get(cacheKey)
      if (cached) return JSON.parse(cached)
    }

    try {
      const result = await this.db.query(`
        SELECT * FROM policies WHERE id = $1
      `, [policyId])

      if (result.rows.length === 0) {
        return null
      }

      const policy = this._mapPolicyRow(result.rows[0])

      if (this.cache) {
        await this.cache.setex(cacheKey, this.cacheTTL, JSON.stringify(policy))
      }

      return policy
    } catch (error) {
      throw new Error(`Failed to get policy: ${error.message}`)
    }
  }

  /**
   * List policies with filters
   */
  async listPolicies(filters = {}) {
    const { tenantId, effect, priority, limit = 100, offset = 0 } = filters

    const where = []
    const values = []
    let paramIndex = 1

    if (tenantId) {
      where.push(`tenant_id = $${paramIndex++}`)
      values.push(tenantId)
    }

    if (effect) {
      where.push(`effect = $${paramIndex++}`)
      values.push(effect)
    }

    if (priority !== undefined) {
      where.push(`priority >= $${paramIndex++}`)
      values.push(priority)
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    try {
      const countResult = await this.db.query(`
        SELECT COUNT(*)::int as total FROM policies ${whereClause}
      `, values)

      const result = await this.db.query(`
        SELECT * FROM policies ${whereClause}
        ORDER BY priority DESC, created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...values, limit, offset])

      return {
        total: countResult.rows[0].total,
        limit,
        offset,
        policies: result.rows.map(row => this._mapPolicyRow(row))
      }
    } catch (error) {
      throw new Error(`Failed to list policies: ${error.message}`)
    }
  }

  // ===================================================================
  // CONDITION EVALUATORS
  // ===================================================================

  /**
   * Evaluate time-based condition
   */
  evaluateTimeCondition(condition, context) {
    const currentTime = context.time || new Date()
    
    if (condition.timeRange) {
      const { start, end, timezone = 'UTC' } = condition.timeRange
      const timeStr = currentTime.toLocaleTimeString('en-US', { 
        timeZone: timezone, 
        hour12: false 
      }).slice(0, 5) // HH:MM format

      const allowed = timeStr >= start && timeStr <= end
      return {
        allowed,
        actual: timeStr,
        expected: `${start}-${end} ${timezone}`,
        reason: allowed ? 'Within allowed time range' : 'Outside allowed time range'
      }
    }

    if (condition.dayOfWeek) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const currentDay = dayNames[currentTime.getDay()]
      const allowedDays = Array.isArray(condition.dayOfWeek) ? 
        condition.dayOfWeek.map(d => d.toLowerCase()) : [condition.dayOfWeek.toLowerCase()]
      
      const allowed = allowedDays.includes(currentDay)
      return {
        allowed,
        actual: currentDay,
        expected: allowedDays,
        reason: allowed ? 'Within allowed days' : 'Outside allowed days'
      }
    }

    if (condition.dateRange) {
      const { start, end } = condition.dateRange
      const currentDate = new Date(currentTime.toDateString())
      const startDate = new Date(start)
      const endDate = new Date(end)

      const allowed = currentDate >= startDate && currentDate <= endDate
      return {
        allowed,
        actual: currentDate.toISOString().split('T')[0],
        expected: `${start} to ${end}`,
        reason: allowed ? 'Within allowed date range' : 'Outside allowed date range'
      }
    }

    return { allowed: true, reason: 'No time conditions specified' }
  }

  /**
   * Evaluate IP-based condition
   */
  evaluateIpCondition(condition, context) {
    const clientIp = context.ip || context.request?.ip

    if (!clientIp) {
      return {
        allowed: false,
        actual: 'unknown',
        expected: condition,
        reason: 'Client IP not available'
      }
    }

    if (condition.whitelist) {
      const allowed = this._checkIpInRanges(clientIp, condition.whitelist)
      return {
        allowed,
        actual: clientIp,
        expected: condition.whitelist,
        reason: allowed ? 'IP in whitelist' : 'IP not in whitelist'
      }
    }

    if (condition.blacklist) {
      const blocked = this._checkIpInRanges(clientIp, condition.blacklist)
      return {
        allowed: !blocked,
        actual: clientIp,
        expected: `not in ${condition.blacklist}`,
        reason: blocked ? 'IP in blacklist' : 'IP not in blacklist'
      }
    }

    return { allowed: true, reason: 'No IP conditions specified' }
  }

  /**
   * Evaluate attribute-based condition
   */
  evaluateAttributeCondition(condition, context) {
    const results = {}
    let allPassed = true

    for (const [attribute, expectedValue] of Object.entries(condition)) {
      const actualValue = this._getNestedValue(context, attribute)
      
      let result
      if (typeof expectedValue === 'object' && expectedValue !== null) {
        // Complex condition with operator
        const [[operator, operandValue]] = Object.entries(expectedValue)
        result = this._evaluateOperator(operator, actualValue, operandValue)
        result.attribute = attribute
        result.operator = operator
        result.expected = operandValue
      } else {
        // Simple equality check
        const allowed = actualValue === expectedValue
        result = {
          allowed,
          actual: actualValue,
          expected: expectedValue,
          attribute,
          operator: 'eq',
          reason: allowed ? 'Attribute matches' : 'Attribute does not match'
        }
      }

      results[attribute] = result
      if (!result.allowed) {
        allPassed = false
      }
    }

    const failedAttributes = Object.entries(results)
      .filter(([_, result]) => !result.allowed)
      .map(([attr, _]) => attr)

    return {
      allowed: allPassed,
      results,
      reason: allPassed ? 'All attributes match' : `Failed attributes: ${failedAttributes.join(', ')}`,
      failedAttributes
    }
  }

  /**
   * Evaluate custom condition
   */
  evaluateCustomCondition(condition, context) {
    try {
      if (typeof condition.evaluate === 'function') {
        const result = condition.evaluate(context)
        return {
          allowed: Boolean(result),
          reason: result ? 'Custom condition passed' : 'Custom condition failed',
          customResult: result
        }
      }

      if (condition.script) {
        // WARNING: eval is dangerous in production. This is for demonstration.
        // In production, use a sandboxed environment or predefined functions.
        const func = new Function('context', condition.script)
        const result = func(context)
        return {
          allowed: Boolean(result),
          reason: result ? 'Script condition passed' : 'Script condition failed',
          scriptResult: result
        }
      }

      return {
        allowed: false,
        reason: 'Invalid custom condition format'
      }
    } catch (error) {
      return {
        allowed: false,
        reason: `Custom condition error: ${error.message}`,
        error: error.message
      }
    }
  }

  // ===================================================================
  // POLICY COMPILATION & VALIDATION
  // ===================================================================

  /**
   * Compile policy for optimized evaluation
   */
  compilePolicy(policyDefinition) {
    const compiled = {
      ...policyDefinition,
      compiled: true,
      compiledAt: new Date(),
      optimizations: []
    }

    // Pre-compile conditions for faster evaluation
    if (policyDefinition.conditions) {
      compiled.compiledConditions = this._compileConditions(policyDefinition.conditions)
      compiled.optimizations.push('conditions_precompiled')
    }

    // Optimize resource matching
    if (policyDefinition.resources) {
      compiled.resourcePatterns = this._compileResourcePatterns(policyDefinition.resources)
      compiled.optimizations.push('resource_patterns_compiled')
    }

    return compiled
  }

  /**
   * Validate policy definition
   */
  validatePolicy(policyDefinition) {
    const errors = []

    // Required fields
    if (!policyDefinition.name) {
      errors.push('Policy name is required')
    }

    if (!policyDefinition.tenantId) {
      errors.push('Tenant ID is required')
    }

    // Effect validation
    if (policyDefinition.effect && !['allow', 'deny'].includes(policyDefinition.effect)) {
      errors.push('Effect must be either "allow" or "deny"')
    }

    // Resources validation
    if (policyDefinition.resources && !Array.isArray(policyDefinition.resources)) {
      errors.push('Resources must be an array')
    }

    // Actions validation
    if (policyDefinition.actions && !Array.isArray(policyDefinition.actions)) {
      errors.push('Actions must be an array')
    }

    // Conditions validation
    if (policyDefinition.conditions) {
      const conditionValidation = this._validateConditions(policyDefinition.conditions)
      errors.push(...conditionValidation.errors)
    }

    // Priority validation
    if (policyDefinition.priority !== undefined && 
        (typeof policyDefinition.priority !== 'number' || policyDefinition.priority < 0)) {
      errors.push('Priority must be a non-negative number')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // ===================================================================
  // INTERNAL METHODS
  // ===================================================================

  /**
   * Internal policy evaluation
   */
  async _evaluatePolicyInternal(policy, context) {
    const conditionResults = {}

    // Evaluate each condition type
    if (policy.conditions.timeRange || policy.conditions.dayOfWeek || policy.conditions.dateRange) {
      conditionResults.time = this.evaluateTimeCondition(policy.conditions, context)
    }

    if (policy.conditions.whitelist || policy.conditions.blacklist) {
      conditionResults.ip = this.evaluateIpCondition(policy.conditions, context)
    }

    if (policy.conditions.attributes) {
      conditionResults.attributes = this.evaluateAttributeCondition(policy.conditions.attributes, context)
    }

    if (policy.conditions.custom) {
      conditionResults.custom = this.evaluateCustomCondition(policy.conditions.custom, context)
    }

    // Check if all conditions pass
    const allConditionsPassed = Object.values(conditionResults).every(result => result.allowed)

    return {
      allowed: allConditionsPassed,
      conditions: conditionResults,
      metadata: {
        conditionsEvaluated: Object.keys(conditionResults).length,
        policyEffect: policy.effect
      }
    }
  }

  /**
   * Evaluate a single condition
   */
  async _evaluateCondition(conditionType, conditionValue, context) {
    switch (conditionType) {
      case 'timeRange':
      case 'dayOfWeek':
      case 'dateRange':
        return this.evaluateTimeCondition({ [conditionType]: conditionValue }, context)
      
      case 'ipWhitelist':
        return this.evaluateIpCondition({ whitelist: conditionValue }, context)
      
      case 'ipBlacklist':
        return this.evaluateIpCondition({ blacklist: conditionValue }, context)
      
      case 'attributes':
        return this.evaluateAttributeCondition(conditionValue, context)
      
      case 'custom':
        return this.evaluateCustomCondition(conditionValue, context)
      
      default:
        // Treat as attribute condition
        const actualValue = this._getNestedValue(context, conditionType)
        const allowed = actualValue === conditionValue
        return {
          allowed,
          actual: actualValue,
          expected: conditionValue,
          reason: allowed ? 'Condition satisfied' : 'Condition not satisfied'
        }
    }
  }

  /**
   * Evaluate operator condition
   */
  _evaluateOperator(operator, actualValue, expectedValue) {
    if (!this.operators[operator]) {
      return {
        allowed: false,
        actual: actualValue,
        expected: expectedValue,
        reason: `Unknown operator: ${operator}`
      }
    }

    try {
      const allowed = this.operators[operator](actualValue, expectedValue)
      return {
        allowed,
        actual: actualValue,
        expected: expectedValue,
        reason: allowed ? `Operator ${operator} satisfied` : `Operator ${operator} not satisfied`
      }
    } catch (error) {
      return {
        allowed: false,
        actual: actualValue,
        expected: expectedValue,
        reason: `Operator evaluation error: ${error.message}`,
        error: error.message
      }
    }
  }

  /**
   * Check if IP is in ranges
   */
  _checkIpInRanges(ip, ranges) {
    for (const range of ranges) {
      if (this._ipInRange(ip, range)) {
        return true
      }
    }
    return false
  }

  /**
   * Check if IP is in CIDR range
   */
  _ipInRange(ip, range) {
    // Simple implementation - in production, use a proper IP library
    if (range.includes('/')) {
      // CIDR notation
      const [rangeIp, prefixLength] = range.split('/')
      // Implementation would depend on IP library
      return ip.startsWith(rangeIp.substring(0, rangeIp.lastIndexOf('.')))
    } else {
      // Exact match
      return ip === range
    }
  }

  /**
   * Get nested value from context
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Validate policy structure
   */
  _validatePolicyStructure(policy) {
    return policy && 
           typeof policy === 'object' &&
           policy.id &&
           policy.name &&
           policy.effect &&
           ['allow', 'deny'].includes(policy.effect)
  }

  /**
   * Validate conditions structure
   */
  _validateConditions(conditions) {
    const errors = []
    
    if (typeof conditions !== 'object') {
      errors.push('Conditions must be an object')
      return { valid: false, errors }
    }

    // Validate each condition type
    for (const [type, value] of Object.entries(conditions)) {
      switch (type) {
        case 'timeRange':
          if (!value.start || !value.end) {
            errors.push('Time range must have start and end times')
          }
          break
        case 'ipWhitelist':
        case 'ipBlacklist':
          if (!Array.isArray(value)) {
            errors.push(`${type} must be an array of IP addresses/ranges`)
          }
          break
        case 'attributes':
          if (typeof value !== 'object') {
            errors.push('Attributes must be an object')
          }
          break
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Compile conditions for optimization
   */
  _compileConditions(conditions) {
    // Pre-compile regex patterns, parse time ranges, etc.
    const compiled = { ...conditions }
    
    if (conditions.attributes) {
      for (const [attr, value] of Object.entries(conditions.attributes)) {
        if (typeof value === 'object' && value.matches) {
          compiled.attributes[attr] = {
            ...value,
            compiledRegex: new RegExp(value.matches)
          }
        }
      }
    }

    return compiled
  }

  /**
   * Compile resource patterns
   */
  _compileResourcePatterns(resources) {
    return resources.map(resource => {
      if (resource.includes('*')) {
        return {
          pattern: resource,
          regex: new RegExp(resource.replace(/\*/g, '.*'))
        }
      }
      return { pattern: resource, exact: true }
    })
  }

  /**
   * Map database row to policy object
   * NOTE: policies table does NOT have a description column
   */
  _mapPolicyRow(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      effect: row.effect,
      resources: row.resources || [],
      actions: row.actions || [],
      conditions: row.conditions || {},
      priority: row.priority,
      enabled: row.enabled !== undefined ? row.enabled : true,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /**
   * Clear tenant policy cache
   */
  async _clearTenantPolicyCache(tenantId) {
    if (!this.cache) return
    // Implementation depends on cache backend
  }

  /**
   * Clear specific policy cache
   */
  async _clearPolicyCache(policyId) {
    if (!this.cache) return
    const cacheKey = `${this.cachePrefix}${policyId}`
    await this.cache.del(cacheKey)
  }

  /**
   * Health check for policy engine
   */
  async healthCheck() {
    try {
      await this.db.query('SELECT 1')
      
      if (this.cache) {
        await this.cache.ping()
      }

      return {
        database: 'healthy',
        cache: this.cache ? 'healthy' : 'not_configured',
        operators: Object.keys(this.operators).length,
        evaluationTimeout: this.evaluationTimeout,
        status: 'operational'
      }
    } catch (error) {
      return {
        database: 'unhealthy',
        cache: 'unknown',
        status: 'degraded',
        error: error.message
      }
    }
  }
}

export default PolicyEngine