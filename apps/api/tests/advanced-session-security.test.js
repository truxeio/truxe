/**
 * Advanced Session Security Tests
 * 
 * Comprehensive test suite for enterprise-grade session security features:
 * - JTI blacklisting and revocation
 * - Device fingerprinting and recognition
 * - Concurrent session limits with priority-based eviction
 * - Anomaly detection (impossible travel, suspicious patterns)
 * - Comprehensive audit logging
 * - Session cleanup and monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { createServer } from '../src/server.js'
import { AdvancedSessionSecurityService } from '../src/services/advanced-session-security.js'
import { getPool } from '../database/connection.js'
import Redis from 'ioredis'
import config from '../src/config/index.js'

describe('Advanced Session Security', () => {
  let server
  let pool
  let redis
  let securityService
  let testUser
  let testOrg

  beforeAll(async () => {
    // Create test server
    server = await createServer()
    await server.ready()
    
    // Initialize services
    pool = getPool()
    redis = new Redis(config.redis.url, {
      keyPrefix: config.redis.keyPrefix + 'test_security:',
    })
    securityService = new AdvancedSessionSecurityService()
    
    // Create test data
    const userResult = await pool.query(
      `INSERT INTO users (email, email_verified, status) 
       VALUES ($1, $2, $3) RETURNING *`,
      ['test@example.com', true, 'active']
    )
    testUser = userResult.rows[0]
    
    const orgResult = await pool.query(
      `INSERT INTO organizations (slug, name) 
       VALUES ($1, $2) RETURNING *`,
      ['test-org', 'Test Organization']
    )
    testOrg = orgResult.rows[0]
    
    // Create membership
    await pool.query(
      `INSERT INTO memberships (org_id, user_id, role, joined_at) 
       VALUES ($1, $2, $3, NOW())`,
      [testOrg.id, testUser.id, 'owner']
    )
  })

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM audit_logs WHERE actor_user_id = $1', [testUser.id])
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [testUser.id])
    await pool.query('DELETE FROM memberships WHERE user_id = $1', [testUser.id])
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrg.id])
    await pool.query('DELETE FROM users WHERE id = $1', [testUser.id])
    
    // Close connections
    await redis.quit()
    await securityService.close()
    await server.close()
  })

  beforeEach(async () => {
    // Clear Redis test data
    const keys = await redis.keys('*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  })

  afterEach(async () => {
    // Clean up sessions after each test
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [testUser.id])
    await pool.query('DELETE FROM audit_logs WHERE actor_user_id = $1', [testUser.id])
  })

  describe('JTI Blacklisting System', () => {
    it('should blacklist a JTI successfully', async () => {
      const jti = 'test-jti-123'
      const reason = 'test_revocation'
      const metadata = { testData: true }

      const result = await securityService.blacklistJTI(jti, reason, metadata)

      expect(result.success).toBe(true)
      expect(result.jti).toBe(jti)
      expect(result.reason).toBe(reason)

      // Verify in Redis
      const redisData = await redis.get(`blacklist:${jti}`)
      expect(redisData).toBeTruthy()
      
      const parsedData = JSON.parse(redisData)
      expect(parsedData.jti).toBe(jti)
      expect(parsedData.reason).toBe(reason)
      expect(parsedData.metadata).toEqual(metadata)

      // Verify audit log
      const auditResult = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE action = 'session.jti_blacklisted' AND target_id = $1`,
        [jti]
      )
      expect(auditResult.rows.length).toBe(1)
    })

    it('should check JTI blacklist status correctly', async () => {
      const jti = 'test-jti-456'
      const reason = 'security_violation'

      // Initially not blacklisted
      let status = await securityService.isJTIBlacklisted(jti)
      expect(status.blacklisted).toBe(false)

      // Blacklist the JTI
      await securityService.blacklistJTI(jti, reason)

      // Now should be blacklisted
      status = await securityService.isJTIBlacklisted(jti)
      expect(status.blacklisted).toBe(true)
      expect(status.reason).toBe(reason)
    })

    it('should remove JTI from blacklist', async () => {
      const jti = 'test-jti-789'
      
      // Blacklist first
      await securityService.blacklistJTI(jti, 'test')
      
      // Verify blacklisted
      let status = await securityService.isJTIBlacklisted(jti)
      expect(status.blacklisted).toBe(true)

      // Remove from blacklist
      const result = await securityService.removeFromBlacklist(jti, 'admin_action')
      expect(result.success).toBe(true)
      expect(result.removed).toBe(true)

      // Verify not blacklisted
      status = await securityService.isJTIBlacklisted(jti)
      expect(status.blacklisted).toBe(false)
    })
  })

  describe('Advanced Device Fingerprinting', () => {
    const mockRequest = {
      ip: '192.168.1.100',
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'connection': 'keep-alive',
      },
    }

    it('should generate comprehensive device fingerprint', () => {
      const fingerprint = securityService.generateAdvancedDeviceFingerprint(mockRequest, {
        customData: 'test',
      })

      expect(fingerprint).toHaveProperty('fingerprint')
      expect(fingerprint).toHaveProperty('stableFingerprint')
      expect(fingerprint).toHaveProperty('ip', mockRequest.ip)
      expect(fingerprint).toHaveProperty('userAgent')
      expect(fingerprint).toHaveProperty('browser')
      expect(fingerprint).toHaveProperty('os')
      expect(fingerprint).toHaveProperty('device')
      expect(fingerprint).toHaveProperty('headers')
      expect(fingerprint).toHaveProperty('generatedAt')

      // Check browser detection
      expect(fingerprint.browser.name).toBe('Chrome')
      expect(fingerprint.browser.engine).toBe('Blink')

      // Check OS detection
      expect(fingerprint.os.name).toBe('macOS')

      // Check device detection
      expect(fingerprint.device.type).toBe('Desktop')

      // Check custom data
      expect(fingerprint.customData).toBe('test')
    })

    it('should detect different browsers correctly', () => {
      const browsers = [
        {
          ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          expected: { name: 'Chrome', engine: 'Blink' },
        },
        {
          ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
          expected: { name: 'Firefox', engine: 'Gecko' },
        },
        {
          ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
          expected: { name: 'Safari', engine: 'WebKit' },
        },
      ]

      browsers.forEach(({ ua, expected }) => {
        const request = { ...mockRequest, headers: { ...mockRequest.headers, 'user-agent': ua } }
        const fingerprint = securityService.generateAdvancedDeviceFingerprint(request)
        
        expect(fingerprint.browser.name).toBe(expected.name)
        expect(fingerprint.browser.engine).toBe(expected.engine)
      })
    })

    it('should check device recognition correctly', async () => {
      const fingerprint = securityService.generateAdvancedDeviceFingerprint(mockRequest)

      // Initially not recognized
      let recognition = await securityService.isDeviceRecognized(testUser.id, fingerprint)
      expect(recognition.recognized).toBe(false)
      expect(recognition.previousSessions).toBe(0)

      // Create a session with this device
      await pool.query(
        `INSERT INTO sessions (jti, user_id, device_info, ip, user_agent, expires_at) 
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 hour')`,
        [
          'test-session-1',
          testUser.id,
          JSON.stringify(fingerprint),
          mockRequest.ip,
          mockRequest.headers['user-agent'],
        ]
      )

      // Now should be recognized
      recognition = await securityService.isDeviceRecognized(testUser.id, fingerprint)
      expect(recognition.recognized).toBe(true)
      expect(recognition.previousSessions).toBe(1)
    })
  })

  describe('Concurrent Session Management', () => {
    it('should enforce session limits with priority-based eviction', async () => {
      const maxSessions = 3
      securityService.config.maxConcurrentSessions = maxSessions

      // Create multiple sessions
      const sessions = []
      for (let i = 0; i < maxSessions + 2; i++) {
        const jti = `test-session-${i}`
        const deviceInfo = securityService.generateAdvancedDeviceFingerprint({
          ip: `192.168.1.${100 + i}`,
          headers: { 'user-agent': `TestAgent-${i}` },
        })

        // Insert session directly to simulate different creation times
        await pool.query(
          `INSERT INTO sessions (jti, user_id, device_info, ip, user_agent, expires_at, created_at, last_used_at) 
           VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 hour', NOW() - INTERVAL '${i} minutes', NOW() - INTERVAL '${i} minutes')`,
          [jti, testUser.id, JSON.stringify(deviceInfo), deviceInfo.ip, deviceInfo.userAgent]
        )

        sessions.push({ jti, deviceInfo })
      }

      // Enforce session limits
      await securityService.enforceAdvancedSessionLimits(testUser.id, {
        deviceInfo: sessions[0].deviceInfo,
        ip: sessions[0].deviceInfo.ip,
        userAgent: sessions[0].deviceInfo.userAgent,
      })

      // Check remaining active sessions
      const activeResult = await pool.query(
        `SELECT COUNT(*) as count FROM sessions 
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
        [testUser.id]
      )
      
      expect(parseInt(activeResult.rows[0].count)).toBeLessThanOrEqual(maxSessions)

      // Check that revoked sessions have proper audit logs
      const auditResult = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE action = 'session.revoked' AND actor_user_id = $1`,
        [testUser.id]
      )
      
      expect(auditResult.rows.length).toBeGreaterThan(0)
    })

    it('should calculate session scores correctly', () => {
      const now = Date.now()
      const baseSession = {
        jti: 'test-session',
        createdAt: new Date(now - 3600000), // 1 hour ago
        lastUsedAt: new Date(now - 1800000), // 30 minutes ago
        deviceInfo: {
          stableFingerprint: 'device-123',
          browser: { name: 'Chrome' },
          os: { name: 'macOS' },
        },
        ip: '192.168.1.100',
      }

      const newSessionInfo = {
        deviceInfo: {
          stableFingerprint: 'device-123', // Same device
          browser: { name: 'Chrome' }, // Same browser
          os: { name: 'macOS' }, // Same OS
        },
        ip: '192.168.1.100', // Same IP
      }

      const score = securityService.calculateSessionScore(baseSession, newSessionInfo)

      // Should have high score due to same device, browser, OS, and IP bonuses
      expect(score).toBeGreaterThan(5000) // Same device bonus
    })
  })

  describe('Anomaly Detection', () => {
    it('should detect impossible travel', async () => {
      // Create a session in San Francisco
      await pool.query(
        `INSERT INTO sessions (jti, user_id, ip, created_at, expires_at) 
         VALUES ($1, $2, $3, NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '1 hour')`,
        ['previous-session', testUser.id, '192.168.1.100']
      )

      // Mock location service to return different locations
      const originalGetLocationFromIP = securityService.getLocationFromIP
      securityService.getLocationFromIP = jest.fn()
        .mockResolvedValueOnce({ lat: 37.7749, lon: -122.4194, city: 'San Francisco', country: 'US' }) // Previous
        .mockResolvedValueOnce({ lat: 40.7128, lon: -74.0060, city: 'New York', country: 'US' }) // Current

      const result = await securityService.detectImpossibleTravel(
        testUser.id,
        { ip: '192.168.1.200' },
        new Date()
      )

      expect(result).toHaveProperty('impossibleTravel')
      expect(result).toHaveProperty('distance')
      expect(result).toHaveProperty('requiredSpeed')
      expect(result).toHaveProperty('threshold', 500)

      // Restore original method
      securityService.getLocationFromIP = originalGetLocationFromIP
    })

    it('should detect suspicious session patterns', async () => {
      // Create multiple sessions from different IPs in short time
      const ips = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103']
      
      for (const ip of ips) {
        await pool.query(
          `INSERT INTO sessions (jti, user_id, ip, created_at, expires_at) 
           VALUES ($1, $2, $3, NOW() - INTERVAL '5 minutes', NOW() + INTERVAL '1 hour')`,
          [`session-${ip}`, testUser.id, ip]
        )
      }

      const sessionData = {
        deviceInfo: securityService.generateAdvancedDeviceFingerprint({
          ip: '192.168.1.104',
          headers: { 'user-agent': 'TestAgent' },
        }),
        ip: '192.168.1.104',
        userAgent: 'TestAgent',
      }

      const result = await securityService.detectSuspiciousPatterns(testUser.id, sessionData)

      expect(result).toHaveProperty('suspicious')
      expect(result).toHaveProperty('patterns')
      expect(result).toHaveProperty('riskScore')
    })
  })

  describe('Comprehensive Audit Logging', () => {
    it('should log security events with structured data', async () => {
      const eventData = {
        userId: testUser.id,
        orgId: testOrg.id,
        action: 'session.test_event',
        target: { type: 'session', id: 'test-session-id' },
        ip: '192.168.1.100',
        userAgent: 'TestAgent',
        deviceInfo: { test: true },
        sessionId: 'test-session-id',
        severity: 'info',
        details: { customData: 'test' },
      }

      const requestId = await securityService.logSecurityEvent(eventData)

      expect(requestId).toBeTruthy()

      // Verify database entry
      const dbResult = await pool.query(
        `SELECT * FROM audit_logs WHERE request_id = $1`,
        [requestId]
      )

      expect(dbResult.rows.length).toBe(1)
      const logEntry = dbResult.rows[0]

      expect(logEntry.org_id).toBe(testOrg.id)
      expect(logEntry.actor_user_id).toBe(testUser.id)
      expect(logEntry.action).toBe('session.test_event')
      expect(logEntry.target_type).toBe('session')
      expect(logEntry.target_id).toBe('test-session-id')
      expect(logEntry.ip).toBe('192.168.1.100')
      expect(logEntry.user_agent).toBe('TestAgent')

      const details = logEntry.details
      expect(details.severity).toBe('info')
      expect(details.customData).toBe('test')
      expect(details.correlationId).toBeTruthy()

      // Verify Redis entry
      const redisKeys = await redis.keys('security_event:*')
      expect(redisKeys.length).toBeGreaterThan(0)
    })

    it('should revoke session with comprehensive audit logging', async () => {
      // Create a test session
      const sessionResult = await pool.query(
        `INSERT INTO sessions (jti, user_id, org_id, ip, user_agent, device_info, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour') RETURNING *`,
        [
          'audit-test-session',
          testUser.id,
          testOrg.id,
          '192.168.1.100',
          'TestAgent',
          JSON.stringify({ test: true }),
        ]
      )

      const session = sessionResult.rows[0]

      // Revoke with audit
      const result = await securityService.revokeSessionWithAudit(
        session.jti,
        'admin_action',
        { adminId: testUser.id, reason: 'security_test' }
      )

      expect(result.success).toBe(true)

      // Verify session is revoked
      const revokedResult = await pool.query(
        `SELECT * FROM sessions WHERE jti = $1`,
        [session.jti]
      )

      expect(revokedResult.rows[0].revoked_at).toBeTruthy()

      // Verify JTI is blacklisted
      const blacklistStatus = await securityService.isJTIBlacklisted(session.jti)
      expect(blacklistStatus.blacklisted).toBe(true)

      // Verify audit logs
      const auditResult = await pool.query(
        `SELECT * FROM audit_logs 
         WHERE action IN ('session.revoked', 'session.jti_blacklisted') 
         AND target_id = $1`,
        [session.jti]
      )

      expect(auditResult.rows.length).toBe(2) // One for revocation, one for blacklisting
    })
  })

  describe('Session Cleanup and Monitoring', () => {
    it('should clean up expired sessions and blacklisted JTIs', async () => {
      // Create expired session
      await pool.query(
        `INSERT INTO sessions (jti, user_id, expires_at, created_at) 
         VALUES ($1, $2, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days')`,
        ['expired-session', testUser.id]
      )

      // Create expired blacklisted JTI
      await redis.setex('blacklist:expired-jti', 1, JSON.stringify({ expired: true }))
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Run cleanup
      await securityService.performCleanup()

      // Verify expired session is cleaned up
      const sessionResult = await pool.query(
        `SELECT * FROM sessions WHERE jti = 'expired-session'`
      )
      expect(sessionResult.rows.length).toBe(0)

      // Verify expired JTI is cleaned up
      const jtiExists = await redis.exists('blacklist:expired-jti')
      expect(jtiExists).toBe(0)
    })

    it('should provide comprehensive health status', async () => {
      const healthStatus = await securityService.getHealthStatus()

      expect(healthStatus).toHaveProperty('status', 'healthy')
      expect(healthStatus).toHaveProperty('features')
      expect(healthStatus).toHaveProperty('redis')
      expect(healthStatus).toHaveProperty('database')
      expect(healthStatus).toHaveProperty('sessions')
      expect(healthStatus).toHaveProperty('config')

      expect(healthStatus.features.jtiBlacklisting).toBe(true)
      expect(healthStatus.redis.connected).toBe(true)
      expect(healthStatus.database.connected).toBe(true)
    })

    it('should generate security dashboard data', async () => {
      // Create some test sessions and events
      await pool.query(
        `INSERT INTO sessions (jti, user_id, ip, user_agent, device_info, expires_at) 
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '1 hour')`,
        [
          'dashboard-session',
          testUser.id,
          '192.168.1.100',
          'TestAgent',
          JSON.stringify({ browser: { name: 'Chrome' }, os: { name: 'macOS' } }),
        ]
      )

      await securityService.logSecurityEvent({
        userId: testUser.id,
        action: 'session.created',
        severity: 'info',
        details: { test: true },
      })

      const dashboardData = await securityService.getSecurityDashboardData('1h')

      expect(dashboardData).toHaveProperty('timeRange', '1h')
      expect(dashboardData).toHaveProperty('generatedAt')
      expect(dashboardData).toHaveProperty('sessions')
      expect(dashboardData).toHaveProperty('securityEvents')
      expect(dashboardData).toHaveProperty('topIPs')
      expect(dashboardData).toHaveProperty('devices')
      expect(dashboardData).toHaveProperty('summary')

      expect(dashboardData.sessions.total).toBeGreaterThan(0)
      expect(dashboardData.securityEvents.length).toBeGreaterThan(0)
      expect(dashboardData.summary.totalSessions).toBeGreaterThan(0)
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle concurrent session operations efficiently', async () => {
      const concurrentOperations = 50
      const operations = []

      // Create concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        operations.push(
          securityService.logSecurityEvent({
            userId: testUser.id,
            action: 'session.load_test',
            severity: 'info',
            details: { operationId: i },
          })
        )
      }

      const startTime = Date.now()
      await Promise.all(operations)
      const duration = Date.now() - startTime

      // Should complete within reasonable time (adjust based on your performance requirements)
      expect(duration).toBeLessThan(5000) // 5 seconds

      // Verify all operations were logged
      const logResult = await pool.query(
        `SELECT COUNT(*) as count FROM audit_logs 
         WHERE action = 'session.load_test' AND actor_user_id = $1`,
        [testUser.id]
      )

      expect(parseInt(logResult.rows[0].count)).toBe(concurrentOperations)
    })

    it('should handle JTI blacklist operations at scale', async () => {
      const jtiCount = 100
      const jtis = Array.from({ length: jtiCount }, (_, i) => `scale-test-jti-${i}`)

      // Blacklist JTIs concurrently
      const startTime = Date.now()
      await Promise.all(
        jtis.map(jti => securityService.blacklistJTI(jti, 'scale_test'))
      )
      const blacklistDuration = Date.now() - startTime

      // Check JTIs concurrently
      const checkStartTime = Date.now()
      const results = await Promise.all(
        jtis.map(jti => securityService.isJTIBlacklisted(jti))
      )
      const checkDuration = Date.now() - checkStartTime

      // All should be blacklisted
      expect(results.every(result => result.blacklisted)).toBe(true)

      // Performance should be reasonable
      expect(blacklistDuration).toBeLessThan(10000) // 10 seconds
      expect(checkDuration).toBeLessThan(5000) // 5 seconds

      console.log(`Blacklist performance: ${jtiCount} operations in ${blacklistDuration}ms`)
      console.log(`Check performance: ${jtiCount} operations in ${checkDuration}ms`)
    })
  })
})

describe('Advanced Session Security API Integration', () => {
  let server
  let pool
  let testUser
  let adminUser
  let authToken

  beforeAll(async () => {
    server = await createServer()
    await server.ready()
    pool = getPool()

    // Create test users
    const userResult = await pool.query(
      `INSERT INTO users (email, email_verified, status) 
       VALUES ($1, $2, $3) RETURNING *`,
      ['user@example.com', true, 'active']
    )
    testUser = userResult.rows[0]

    const adminResult = await pool.query(
      `INSERT INTO users (email, email_verified, status) 
       VALUES ($1, $2, $3) RETURNING *`,
      ['admin@example.com', true, 'active']
    )
    adminUser = adminResult.rows[0]

    // Create organization and admin membership
    const orgResult = await pool.query(
      `INSERT INTO organizations (slug, name) 
       VALUES ($1, $2) RETURNING *`,
      ['api-test-org', 'API Test Organization']
    )

    await pool.query(
      `INSERT INTO memberships (org_id, user_id, role, joined_at) 
       VALUES ($1, $2, $3, NOW())`,
      [orgResult.rows[0].id, adminUser.id, 'admin']
    )

    // Generate auth token for admin (simplified for testing)
    const { default: jwtService } = await import('../src/services/jwt.js')
    const tokenResult = await jwtService.createAccessToken({
      userId: adminUser.id,
      email: adminUser.email,
      emailVerified: true,
      role: 'admin',
      permissions: ['admin:security'],
    })
    authToken = tokenResult.token
  })

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM audit_logs WHERE actor_user_id IN ($1, $2)', [testUser.id, adminUser.id])
    await pool.query('DELETE FROM sessions WHERE user_id IN ($1, $2)', [testUser.id, adminUser.id])
    await pool.query('DELETE FROM memberships WHERE user_id IN ($1, $2)', [testUser.id, adminUser.id])
    await pool.query('DELETE FROM organizations WHERE slug = $1', ['api-test-org'])
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser.id, adminUser.id])
    
    await server.close()
  })

  describe('Security Dashboard API', () => {
    it('should return security dashboard data', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/security/dashboard?timeRange=1h',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      
      const data = JSON.parse(response.payload)
      expect(data).toHaveProperty('timeRange', '1h')
      expect(data).toHaveProperty('generatedAt')
      expect(data).toHaveProperty('sessions')
      expect(data).toHaveProperty('securityEvents')
      expect(data).toHaveProperty('summary')
    })

    it('should require admin role for dashboard access', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/security/dashboard',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('Session Management API', () => {
    let testSession

    beforeEach(async () => {
      // Create test session
      const sessionResult = await pool.query(
        `INSERT INTO sessions (jti, user_id, ip, user_agent, expires_at) 
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour') RETURNING *`,
        ['api-test-session', testUser.id, '192.168.1.100', 'TestAgent']
      )
      testSession = sessionResult.rows[0]
    })

    afterEach(async () => {
      await pool.query('DELETE FROM sessions WHERE jti = $1', [testSession.jti])
    })

    it('should list sessions with filters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/security/sessions?userId=${testUser.id}&status=active&limit=10`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      })

      expect(response.statusCode).toBe(200)
      
      const data = JSON.parse(response.payload)
      expect(data).toHaveProperty('sessions')
      expect(data).toHaveProperty('pagination')
      expect(data.sessions.length).toBeGreaterThan(0)
      expect(data.sessions[0]).toHaveProperty('jti')
      expect(data.sessions[0]).toHaveProperty('status', 'active')
    })

    it('should revoke session via API', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/security/revoke',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          target: {
            type: 'session',
            id: testSession.jti,
          },
          reason: 'api_test',
        }),
      })

      expect(response.statusCode).toBe(200)
      
      const data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.revokedSessions).toBe(1)

      // Verify session is revoked
      const sessionResult = await pool.query(
        `SELECT * FROM sessions WHERE jti = $1`,
        [testSession.jti]
      )
      expect(sessionResult.rows[0].revoked_at).toBeTruthy()
    })
  })

  describe('JTI Blacklist Management API', () => {
    it('should manage JTI blacklist via API', async () => {
      const testJTI = 'api-test-jti'

      // Add to blacklist
      let response = await server.inject({
        method: 'POST',
        url: '/security/blacklist',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          action: 'add',
          jti: testJTI,
          reason: 'api_test',
        }),
      })

      expect(response.statusCode).toBe(200)
      let data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.blacklisted).toBe(true)

      // Check blacklist status
      response = await server.inject({
        method: 'POST',
        url: '/security/blacklist',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          action: 'check',
          jti: testJTI,
        }),
      })

      expect(response.statusCode).toBe(200)
      data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.blacklisted).toBe(true)

      // Remove from blacklist
      response = await server.inject({
        method: 'POST',
        url: '/security/blacklist',
        headers: {
          authorization: `Bearer ${authToken}`,
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          action: 'remove',
          jti: testJTI,
          reason: 'api_test_cleanup',
        }),
      })

      expect(response.statusCode).toBe(200)
      data = JSON.parse(response.payload)
      expect(data.success).toBe(true)
      expect(data.blacklisted).toBe(false)
    })
  })

  describe('Security Health API', () => {
    it('should return security service health status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/security/health',
      })

      expect(response.statusCode).toBe(200)
      
      const data = JSON.parse(response.payload)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('features')
      expect(data).toHaveProperty('redis')
      expect(data).toHaveProperty('database')
      expect(data).toHaveProperty('config')
    })
  })
})
