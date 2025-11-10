/**
 * Tenant Repository
 *
 * Centralized data-access layer for tenant hierarchy operations. Abstracts
 * PostgreSQL queries, enforces Row Level Security context, and exposes
 * transactional helpers for the higher-level services.
 */

import { getPool } from '../../database/connection.js'
import {
  MAX_BATCH_SIZE,
  QUERY_TIMEOUT,
} from './config.js'

/**
 * Map snake_case database row into camelCase tenant object.
 * @param {any} row
 * @returns {object|null}
 */
function mapTenant(row) {
  if (!row) return null
  return {
    id: row.id,
    parentId: row.parent_tenant_id,
    tenantType: row.tenant_type,
    level: row.level,
    path: row.path,
    maxDepth: row.max_depth,
    name: row.name,
    slug: row.slug,
    description: row.description,
    settings: row.settings || {},
    metadata: row.metadata || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    ancestorPath: row.ancestor_path || null,
    descendantCount: typeof row.descendant_count === 'number' ? Number(row.descendant_count) : null,
    childCount: typeof row.child_count === 'number' ? Number(row.child_count) : null,
  }
}

/**
 * Repository for direct database access.
 */
export class TenantRepository {
  constructor({ pool = getPool() } = {}) {
    this.pool = pool
  }

  /**
   * Set Postgres session context and query timeouts.
   * @param {import('pg').PoolClient} client
   * @param {string|null} userId
   */
  async _prepareClient(client, userId) {
    await client.query(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT}`)
    if (userId) {
      await client.query('SET LOCAL app.current_user_id = $1', [userId])
    }
  }

  /**
   * Execute query with optional existing client (for transactions).
   * @param {object} options
   * @param {string} options.text
   * @param {any[]} [options.values]
   * @param {import('pg').PoolClient} [options.client]
   * @param {string|null} [options.userId]
   * @returns {Promise<import('pg').QueryResult>}
   */
  async query({ text, values = [], client = null, userId = null }) {
    const localClient = client || await this.pool.connect()
    const ownsClient = !client
    try {
      if (ownsClient) {
        await localClient.query('BEGIN')
        await this._prepareClient(localClient, userId)
      }
      const result = await localClient.query(text, values)
      if (ownsClient) {
        await localClient.query('COMMIT')
      }
      return result
    } catch (error) {
      if (ownsClient) {
        await localClient.query('ROLLBACK')
      }
      throw error
    } finally {
      if (ownsClient) {
        localClient.release()
      }
    }
  }

  /**
   * Run a callback inside a transaction.
   * @template T
   * @param {object} options
   * @param {string|null} [options.userId]
   * @param {(client: import('pg').PoolClient) => Promise<T>} callback
   * @returns {Promise<T>}
   */
  async transaction({ userId = null } = {}, callback) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      await this._prepareClient(client, userId)
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Begin transaction manually when advanced control is required.
   * @param {object} options
   * @param {string|null} [options.userId]
   * @returns {Promise<import('pg').PoolClient>}
   */
  async beginTransaction({ userId = null } = {}) {
    const client = await this.pool.connect()
    await client.query('BEGIN')
    await this._prepareClient(client, userId)
    return client
  }

  /**
   * Commit transaction.
   * @param {import('pg').PoolClient} client
   */
  async commit(client) {
    await client.query('COMMIT')
    client.release()
  }

  /**
   * Rollback transaction.
   * @param {import('pg').PoolClient} client
   */
  async rollback(client) {
    try {
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  }

  /**
   * Find tenant by ID.
   */
  async findById(id, { userId = null, includeArchived = false, client = null } = {}) {
    const result = await this.query({
      text: `
        SELECT 
          t.*,
          COALESCE(child_counts.child_count, 0) AS child_count
        FROM tenants t
        LEFT JOIN (
          SELECT parent_tenant_id, COUNT(*) AS child_count
          FROM tenants
          GROUP BY parent_tenant_id
        ) child_counts ON child_counts.parent_tenant_id = t.id
        WHERE t.id = $1
        ${includeArchived ? '' : `AND t.status != 'archived'`}
        LIMIT 1
      `,
      values: [id],
      userId,
      client,
    })
    return mapTenant(result.rows[0])
  }

  /**
   * Find tenant by slug within optional parent scope.
   */
  async findBySlug(slug, { parentId = null, userId = null, includeArchived = false, client = null } = {}) {
    const values = [slug]
    let filter = 't.slug = $1'
    if (parentId) {
      values.push(parentId)
      filter += ` AND t.parent_tenant_id = $${values.length}`
    } else {
      filter += ' AND t.parent_tenant_id IS NULL'
    }
    if (!includeArchived) {
      filter += ' AND t.status != \'archived\''
    }

    const result = await this.query({
      text: `
        SELECT 
          t.*,
          COALESCE(child_counts.child_count, 0) AS child_count
        FROM tenants t
        LEFT JOIN (
          SELECT parent_tenant_id, COUNT(*) AS child_count
          FROM tenants
          GROUP BY parent_tenant_id
        ) child_counts ON child_counts.parent_tenant_id = t.id
        WHERE ${filter}
        LIMIT 1
      `,
      values,
      userId,
      client,
    })
    return mapTenant(result.rows[0])
  }

  /**
   * Find tenant by exact materialized path match.
   */
  async findByPath(pathArray, { userId = null, client = null } = {}) {
    const result = await this.query({
      text: `
        SELECT t.*
        FROM tenants t
        WHERE t.path = $1
        LIMIT 1
      `,
      values: [pathArray],
      userId,
      client,
    })
    return mapTenant(result.rows[0])
  }

  /**
   * Load tenant along with ancestor chain.
   */
  async findWithAncestors(id, { userId = null, client = null } = {}) {
    const result = await this.query({
      text: `
        SELECT 
          t.*,
          ancestors.ancestor_path
        FROM tenants t
        LEFT JOIN LATERAL (
          SELECT ARRAY(
            SELECT jsonb_build_object(
              'id', ancestor.id,
              'name', ancestor.name,
              'slug', ancestor.slug,
              'tenant_type', ancestor.tenant_type,
              'level', ancestor.level
            )
            FROM tenants ancestor
            WHERE ancestor.id = ANY(t.path)
            ORDER BY array_position(t.path, ancestor.id)
          ) AS ancestor_path
        ) ancestors ON true
        WHERE t.id = $1
        LIMIT 1
      `,
      values: [id],
      userId,
      client,
    })
    const row = result.rows[0]
    return row ? { ...mapTenant(row), ancestors: row.ancestor_path || [] } : null
  }

  /**
   * Load tenant with descendants up to optional depth.
   */
  async findWithDescendants(id, { maxDepth = null, userId = null, client = null } = {}) {
    const values = [id]
    const depthFilter = maxDepth !== null
      ? `AND descendant.level <= root.level + $2`
      : ''
    if (maxDepth !== null) values.push(maxDepth)

    const result = await this.query({
      text: `
        WITH RECURSIVE tenant_tree AS (
          SELECT 
            root.*,
            ARRAY[]::uuid[] AS ancestor_ids
          FROM tenants root
          WHERE root.id = $1
          UNION ALL
          SELECT
            child.*,
            tenant_tree.ancestor_ids || tenant_tree.id
          FROM tenants child
          JOIN tenant_tree ON child.parent_tenant_id = tenant_tree.id
          WHERE true ${depthFilter}
        )
        SELECT * FROM tenant_tree
        ORDER BY level ASC
      `,
      values,
      userId,
      client,
    })
    return result.rows.map(mapTenant)
  }

  /**
   * Generic filter with pagination.
   */
  async findByFilters({ filters = {}, pagination = {}, userId = null, client = null } = {}) {
    const where = []
    const values = []

    if (filters.tenantType) {
      values.push(filters.tenantType)
      where.push(`t.tenant_type = $${values.length}`)
    }
    if (filters.status) {
      values.push(filters.status)
      where.push(`t.status = $${values.length}`)
    } else {
      where.push(`t.status != 'archived'`)
    }
    if (filters.level !== undefined) {
      values.push(filters.level)
      where.push(`t.level = $${values.length}`)
    }
    if (filters.parentId) {
      values.push(filters.parentId)
      where.push(`t.parent_tenant_id = $${values.length}`)
    }
    if (filters.search) {
      values.push(`%${filters.search}%`)
      where.push(`(t.name ILIKE $${values.length} OR t.slug ILIKE $${values.length})`)
    }
    if (filters.pathContains) {
      values.push(filters.pathContains)
      where.push(`$${values.length} = ANY(t.path)`)
    }

    const limit = Math.min(pagination.limit || 25, MAX_BATCH_SIZE)
    const offset = pagination.offset || 0
    const orderBy = pagination.orderBy || 'created_at'
    const direction = pagination.direction === 'asc' ? 'ASC' : 'DESC'

    const result = await this.query({
      text: `
        SELECT 
          t.*,
          COALESCE(child_counts.child_count, 0) AS child_count
        FROM tenants t
        LEFT JOIN (
          SELECT parent_tenant_id, COUNT(*) AS child_count
          FROM tenants
          GROUP BY parent_tenant_id
        ) child_counts ON child_counts.parent_tenant_id = t.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${orderBy} ${direction}
        LIMIT ${limit} OFFSET ${offset}
      `,
      values,
      userId,
      client,
    })

    return result.rows.map(mapTenant)
  }

  /**
   * Count tenants by type.
   */
  async countByType({ userId = null, client = null } = {}) {
    const result = await this.query({
      text: `
        SELECT tenant_type, COUNT(*)::bigint AS count
        FROM tenants
        WHERE status != 'archived'
        GROUP BY tenant_type
      `,
      userId,
      client,
    })
    return result.rows.map(row => ({
      tenantType: row.tenant_type,
      count: Number(row.count),
    }))
  }

  /**
   * Count tenants by level.
   */
  async countByLevel({ userId = null, client = null } = {}) {
    const result = await this.query({
      text: `
        SELECT level, COUNT(*)::bigint AS count
        FROM tenants
        WHERE status != 'archived'
        GROUP BY level
        ORDER BY level ASC
      `,
      userId,
      client,
    })
    return result.rows.map(row => ({
      level: Number(row.level),
      count: Number(row.count),
    }))
  }

  /**
   * Get aggregated tenant statistics.
   */
  async getStatistics({ userId = null, client = null } = {}) {
    const result = await this.query({
      text: `
        SELECT
          COUNT(*) FILTER (WHERE status = 'active')::bigint AS active_count,
          COUNT(*) FILTER (WHERE status = 'suspended')::bigint AS suspended_count,
          COUNT(*) FILTER (WHERE status = 'archived')::bigint AS archived_count,
          MAX(level) AS max_level,
          AVG(child_counts.child_count)::numeric AS avg_children
        FROM tenants t
        LEFT JOIN (
          SELECT parent_tenant_id, COUNT(*) AS child_count
          FROM tenants
          GROUP BY parent_tenant_id
        ) child_counts ON child_counts.parent_tenant_id = t.id
      `,
      userId,
      client,
    })
    const row = result.rows[0]
    return {
      activeCount: Number(row.active_count || 0),
      suspendedCount: Number(row.suspended_count || 0),
      archivedCount: Number(row.archived_count || 0),
      maxLevel: row.max_level !== null ? Number(row.max_level) : 0,
      averageChildren: row.avg_children !== null ? Number(row.avg_children) : 0,
    }
  }
}

export default TenantRepository
