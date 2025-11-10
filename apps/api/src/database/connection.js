/**
 * Database Connection Module for Heimdall API
 * 
 * Creates and manages PostgreSQL connection pool using environment variables
 */

import pg from 'pg'
import config from '../config/index.js'

const { Pool } = pg

let pool = null

/**
 * Create database connection pool
 */
function createPool() {
  if (pool) {
    return pool
  }

  pool = new Pool({
    connectionString: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    min: config.database.poolMin,
    max: config.database.poolMax,
    connectionTimeoutMillis: config.database.connectionTimeout,
    statementTimeout: config.database.statementTimeout,
    idleTimeoutMillis: 30000,
    allowExitOnIdle: true,
  })

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Database pool error:', err.message)
  })

  pool.on('connect', (client) => {
    console.log('Database client connected')
  })

  pool.on('remove', (client) => {
    console.log('Database client removed')
  })

  console.log('Database connection pool created')
  return pool
}

/**
 * Get database connection pool
 */
export function getPool() {
  if (!pool) {
    return createPool()
  }
  return pool
}

/**
 * Close database connection pool
 */
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    console.log('Database connection pool closed')
  }
}

/**
 * Test database connection
 */
export async function testConnection() {
  try {
    const client = await getPool().connect()
    const result = await client.query('SELECT NOW() as current_time')
    client.release()
    console.log('Database connection test successful:', result.rows[0].current_time)
    return true
  } catch (error) {
    console.error('Database connection test failed:', error.message)
    return false
  }
}

// Initialize pool on module load
createPool()

// Export default object for compatibility with startup validation
export default {
  raw: async (query) => {
    const client = await getPool().connect()
    try {
      const result = await client.query(query)
      return result
    } finally {
      client.release()
    }
  },
  query: async (query, params) => {
    const client = await getPool().connect()
    try {
      const result = await client.query(query, params)
      return result
    } finally {
      client.release()
    }
  }
}
