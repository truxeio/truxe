/**
 * Audit Logger Service
 * 
 * Comprehensive audit logging for all organization changes and port operations:
 * - Organization lifecycle events
 * - Membership changes and invitations
 * - Port management operations
 * - Security events and access control
 * - System configuration changes
 */

import { Pool } from 'pg'
import config from '../config/index.js'

// Database connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  min: config.database.poolMin,
  max: config.database.poolMax,
  connectionTimeoutMillis: config.database.connectionTimeout,
  statement_timeout: config.database.statementTimeout,
})

/**
 * Audit Logger Service
 */
export class AuditLoggerService {
  constructor() {
    this.batchSize = 100
    this.flushInterval = 5000 // 5 seconds
    this.pendingLogs = []
    this.flushTimer = null
    
    // Start batch processing
    this.startBatchProcessing()
  }

  /**
   * Log organization event
   */
  async logOrganizationEvent({
    action,
    orgId,
    actorUserId,
    targetType = 'organization',
    targetId = null,
    details = {},
    ip = null,
    userAgent = null,
    requestId = null,
  }) {
    return await this.logEvent({
      action,
      orgId,
      actorUserId,
      targetType,
      targetId: targetId || orgId,
      details,
      ip,
      userAgent,
      requestId,
      category: 'organization',
    })
  }

  /**
   * Log membership event
   */
  async logMembershipEvent({
    action,
    orgId,
    actorUserId,
    targetUserId,
    details = {},
    ip = null,
    userAgent = null,
    requestId = null,
  }) {
    return await this.logEvent({
      action,
      orgId,
      actorUserId,
      targetType: 'user',
      targetId: targetUserId,
      details,
      ip,
      userAgent,
      requestId,
      category: 'membership',
    })
  }

  /**
   * Log port management event
   */
  async logPortEvent({
    action,
    port,
    service,
    environment,
    actorUserId = null,
    details = {},
    ip = null,
    userAgent = null,
    requestId = null,
  }) {
    return await this.logEvent({
      action,
      orgId: null, // Port events are system-wide
      actorUserId,
      targetType: 'port',
      targetId: port.toString(),
      details: {
        ...details,
        port,
        service,
        environment,
      },
      ip,
      userAgent,
      requestId,
      category: 'port_management',
    })
  }

  /**
   * Log security event
   */
  async logSecurityEvent({
    action,
    orgId = null,
    actorUserId = null,
    targetType = 'system',
    targetId = null,
    details = {},
    severity = 'info',
    ip = null,
    userAgent = null,
    requestId = null,
  }) {
    return await this.logEvent({
      action,
      orgId,
      actorUserId,
      targetType,
      targetId,
      details: {
        ...details,
        severity,
      },
      ip,
      userAgent,
      requestId,
      category: 'security',
    })
  }

  /**
   * Log system configuration event
   */
  async logSystemEvent({
    action,
    actorUserId = null,
    targetType = 'system',
    targetId = null,
    details = {},
    ip = null,
    userAgent = null,
    requestId = null,
  }) {
    return await this.logEvent({
      action,
      orgId: null,
      actorUserId,
      targetType,
      targetId,
      details,
      ip,
      userAgent,
      requestId,
      category: 'system',
    })
  }

  /**
   * Generic event logging method
   */
  async logEvent({
    action,
    orgId = null,
    actorUserId = null,
    targetType,
    targetId,
    details = {},
    ip = null,
    userAgent = null,
    requestId = null,
    category = 'general',
  }) {
    const logEntry = {
      action,
      orgId,
      actorUserId,
      targetType,
      targetId,
      details: {
        ...details,
        category,
        timestamp: new Date().toISOString(),
      },
      ip,
      userAgent,
      requestId,
      createdAt: new Date(),
    }

    // Add to batch for processing
    this.pendingLogs.push(logEntry)

    // Flush immediately for critical events
    if (this.isCriticalEvent(action, category)) {
      await this.flushLogs()
    }

    return logEntry
  }

  /**
   * Batch log multiple events
   */
  async logBatch(events) {
    const logEntries = events.map(event => ({
      ...event,
      details: {
        ...event.details,
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date(),
    }))

    this.pendingLogs.push(...logEntries)

    // Flush if batch is getting large
    if (this.pendingLogs.length >= this.batchSize) {
      await this.flushLogs()
    }
  }

  /**
   * Query audit logs
   */
  async queryLogs({
    orgId = null,
    actorUserId = null,
    action = null,
    targetType = null,
    category = null,
    startDate = null,
    endDate = null,
    limit = 100,
    offset = 0,
    orderBy = 'created_at',
    orderDirection = 'DESC',
  }) {
    const client = await pool.connect()
    
    try {
      // Build WHERE clause
      const conditions = []
      const params = []
      let paramIndex = 1

      if (orgId) {
        conditions.push(`org_id = $${paramIndex}`)
        params.push(orgId)
        paramIndex++
      }

      if (actorUserId) {
        conditions.push(`actor_user_id = $${paramIndex}`)
        params.push(actorUserId)
        paramIndex++
      }

      if (action) {
        conditions.push(`action = $${paramIndex}`)
        params.push(action)
        paramIndex++
      }

      if (targetType) {
        conditions.push(`target_type = $${paramIndex}`)
        params.push(targetType)
        paramIndex++
      }

      if (category) {
        conditions.push(`details->>'category' = $${paramIndex}`)
        params.push(category)
        paramIndex++
      }

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex}`)
        params.push(startDate)
        paramIndex++
      }

      if (endDate) {
        conditions.push(`created_at <= $${paramIndex}`)
        params.push(endDate)
        paramIndex++
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      
      // Add pagination parameters
      params.push(limit, offset)
      const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

      // Execute query
      const query = `
        SELECT 
          id,
          org_id,
          actor_user_id,
          action,
          target_type,
          target_id,
          details,
          ip,
          user_agent,
          request_id,
          created_at
        FROM audit_logs 
        ${whereClause}
        ORDER BY ${orderBy} ${orderDirection}
        ${limitClause}
      `

      const result = await client.query(query, params)

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs 
        ${whereClause}
      `
      const countResult = await client.query(countQuery, params.slice(0, -2))
      const total = parseInt(countResult.rows[0].total)

      return {
        logs: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      }
    } finally {
      client.release()
    }
  }

  /**
   * Get audit log statistics
   */
  async getLogStatistics({
    orgId = null,
    timeframe = '24h',
    groupBy = 'action',
  }) {
    const client = await pool.connect()
    
    try {
      const timeframeStart = this.calculateTimeframeStart(timeframe)
      
      let groupByClause
      switch (groupBy) {
        case 'action':
          groupByClause = 'action'
          break
        case 'category':
          groupByClause = "details->>'category'"
          break
        case 'target_type':
          groupByClause = 'target_type'
          break
        case 'hour':
          groupByClause = "date_trunc('hour', created_at)"
          break
        case 'day':
          groupByClause = "date_trunc('day', created_at)"
          break
        default:
          groupByClause = 'action'
      }

      const conditions = ['created_at >= $1']
      const params = [timeframeStart]
      let paramIndex = 2

      if (orgId) {
        conditions.push(`org_id = $${paramIndex}`)
        params.push(orgId)
        paramIndex++
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`

      const query = `
        SELECT 
          ${groupByClause} as group_key,
          COUNT(*) as count,
          COUNT(DISTINCT actor_user_id) as unique_actors,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence
        FROM audit_logs 
        ${whereClause}
        GROUP BY ${groupByClause}
        ORDER BY count DESC
        LIMIT 50
      `

      const result = await client.query(query, params)

      return {
        timeframe,
        groupBy,
        statistics: result.rows.map(row => ({
          key: row.group_key,
          count: parseInt(row.count),
          uniqueActors: parseInt(row.unique_actors),
          firstOccurrence: row.first_occurrence,
          lastOccurrence: row.last_occurrence,
        })),
      }
    } finally {
      client.release()
    }
  }

  /**
   * Export audit logs
   */
  async exportLogs({
    orgId = null,
    startDate,
    endDate,
    format = 'json',
    includeDetails = true,
  }) {
    const logs = await this.queryLogs({
      orgId,
      startDate,
      endDate,
      limit: 10000, // Large limit for export
      offset: 0,
    })

    const exportData = {
      exportedAt: new Date().toISOString(),
      orgId,
      startDate,
      endDate,
      totalLogs: logs.pagination.total,
      logs: logs.logs.map(log => ({
        id: log.id,
        action: log.action,
        actorUserId: log.actor_user_id,
        targetType: log.target_type,
        targetId: log.target_id,
        details: includeDetails ? log.details : undefined,
        ip: log.ip,
        userAgent: log.user_agent,
        requestId: log.request_id,
        createdAt: log.created_at,
      })),
    }

    if (format === 'csv') {
      return this.convertToCSV(exportData.logs)
    }

    return exportData
  }

  /**
   * Flush pending logs to database
   */
  async flushLogs() {
    if (this.pendingLogs.length === 0) return

    const logsToFlush = [...this.pendingLogs]
    this.pendingLogs = []

    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')

      for (const log of logsToFlush) {
        await client.query(`
          INSERT INTO audit_logs (
            org_id, actor_user_id, action, target_type, target_id, 
            details, ip, user_agent, request_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          log.orgId,
          log.actorUserId,
          log.action,
          log.targetType,
          log.targetId,
          JSON.stringify(log.details),
          log.ip,
          log.userAgent,
          log.requestId,
          log.createdAt,
        ])
      }

      await client.query('COMMIT')
      
      console.log(`Flushed ${logsToFlush.length} audit log entries`)
    } catch (error) {
      await client.query('ROLLBACK')
      
      // Re-add logs to pending if flush failed
      this.pendingLogs.unshift(...logsToFlush)
      
      console.error('Failed to flush audit logs:', error.message)
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Start batch processing
   */
  startBatchProcessing() {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flushLogs()
      } catch (error) {
        console.error('Batch flush error:', error.message)
      }
    }, this.flushInterval)
  }

  /**
   * Stop batch processing
   */
  async stopBatchProcessing() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    
    // Flush any remaining logs
    await this.flushLogs()
  }

  /**
   * Check if event is critical and needs immediate logging
   */
  isCriticalEvent(action, category) {
    const criticalActions = [
      'org.deleted',
      'membership.removed',
      'security.breach_detected',
      'security.suspicious_activity',
      'port.conflict_detected',
      'system.configuration_changed',
    ]
    
    const criticalCategories = ['security']
    
    return criticalActions.includes(action) || criticalCategories.includes(category)
  }

  /**
   * Calculate timeframe start date
   */
  calculateTimeframeStart(timeframe) {
    const now = new Date()
    
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000)
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
  }

  /**
   * Convert logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return ''

    const headers = [
      'id', 'action', 'actorUserId', 'targetType', 'targetId',
      'ip', 'userAgent', 'requestId', 'createdAt'
    ]

    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.id,
        log.action,
        log.actorUserId || '',
        log.targetType,
        log.targetId || '',
        log.ip || '',
        `"${(log.userAgent || '').replace(/"/g, '""')}"`,
        log.requestId || '',
        log.createdAt,
      ].join(','))
    ]

    return csvRows.join('\n')
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      const client = await pool.connect()
      
      try {
        // Test database connection
        await client.query('SELECT 1')
        
        // Get recent log count
        const recentLogs = await client.query(`
          SELECT COUNT(*) as count 
          FROM audit_logs 
          WHERE created_at >= now() - interval '1 hour'
        `)
        
        return {
          status: 'healthy',
          pendingLogs: this.pendingLogs.length,
          recentLogCount: parseInt(recentLogs.rows[0].count),
          batchProcessing: this.flushTimer !== null,
        }
      } finally {
        client.release()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        pendingLogs: this.pendingLogs.length,
      }
    }
  }
}

// Create singleton instance
const auditLogger = new AuditLoggerService()

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Shutting down audit logger...')
  await auditLogger.stopBatchProcessing()
})

process.on('SIGTERM', async () => {
  console.log('Shutting down audit logger...')
  await auditLogger.stopBatchProcessing()
})

export default auditLogger
