/**
 * Session Cleanup Processor
 *
 * Background job processor for cleaning up expired sessions and JTI blacklist entries.
 * Migrated from setInterval-based cleanup in session.js
 */

import { getPool } from '../../database/connection.js'
import config from '../../config/index.js'

/**
 * Process session cleanup job
 * @param {Job} job - BullMQ job instance
 * @returns {Promise<Object>} Cleanup results
 */
export async function sessionCleanupProcessor(job) {
  const startTime = Date.now()
  const db = getPool()

  try {
    console.log(`[SessionCleanup] Starting cleanup job ${job.id}`)

    // 1. Clean up expired sessions
    const sessionResult = await db.query(`
      DELETE FROM sessions
      WHERE expires_at < NOW()
      RETURNING jti
    `)

    const expiredSessionsCount = sessionResult.rowCount

    // 2. Clean up old revoked sessions (keep revoked sessions for 30 days for audit)
    const jtiResult = await db.query(`
      DELETE FROM sessions
      WHERE revoked_at IS NOT NULL
        AND revoked_at < NOW() - INTERVAL '30 days'
      RETURNING jti
    `)

    const expiredJtiCount = jtiResult.rowCount

    // 3. Clean up old session activity logs (optional, keep last 30 days)
    // Check if session_activity table exists first
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'session_activity'
      )
    `)

    let cleanedActivityCount = 0
    if (tableCheck.rows[0].exists) {
      const activityResult = await db.query(`
        DELETE FROM session_activity
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING id
      `)
      cleanedActivityCount = activityResult.rowCount
    }

    const duration = Date.now() - startTime

    const result = {
      success: true,
      expiredSessions: expiredSessionsCount,
      revokedSessionsCleaned: expiredJtiCount,
      cleanedActivityLogs: cleanedActivityCount,
      totalCleaned: expiredSessionsCount + expiredJtiCount + cleanedActivityCount,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }

    console.log(`[SessionCleanup] Completed:`, result)

    return result
  } catch (error) {
    console.error(`[SessionCleanup] Error in job ${job.id}:`, error)
    throw error
  }
}

export default sessionCleanupProcessor
