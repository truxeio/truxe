/**
 * Path Service
 *
 * Provides materialized path utilities for querying and maintaining tenant
 * paths. Uses PostgreSQL array operators for efficient lookups and exposes
 * helpers for relationship analysis between tenants.
 */

import TenantRepository from './repository.js'
import CacheManager from './utils/cache-manager.js'
import {
  formatPathString,
  getPathDistance,
} from './utils/path-formatter.js'

export class PathService {
  constructor({
    repository = new TenantRepository(),
    cache = new CacheManager({ ttl: 120 }),
  } = {}) {
    this.repository = repository
    this.cache = cache
  }

  async getTenantsByPath(pathPattern, { userId = null, client = null } = {}) {
    if (!pathPattern) return []

    const cacheKey = CacheManager.key('path-pattern', pathPattern)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const wildcard = pathPattern.includes('*')
    let text
    let values
    if (wildcard) {
      const likePattern = pathPattern
        .replace(/\s*>\s*/g, '.')
        .replace(/\*/g, '%')
      text = `
        SELECT *
        FROM tenants
        WHERE array_to_string(path, '.') ILIKE $1
        ORDER BY level ASC
      `
      values = [likePattern]
    } else {
      text = `
        SELECT *
        FROM tenants
        WHERE array_to_string(path, '.') = $1
        ORDER BY level ASC
      `
      values = [pathPattern.replace(/\s*>\s*/g, '.')]
    }

    const result = await this.repository.query({ text, values, userId, client })
    const tenants = result.rows.map(row => ({
      id: row.id,
      path: row.path,
      level: row.level,
      name: row.name,
      slug: row.slug,
      status: row.status,
    }))
    this.cache.set(cacheKey, tenants, 30)
    return tenants
  }

  async searchByPathDepth(depth, { userId = null, client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT *
        FROM tenants
        WHERE array_length(path, 1) = $1
        ORDER BY name ASC
      `,
      values: [depth],
      userId,
      client,
    })
    return result.rows.map(row => ({
      id: row.id,
      path: row.path,
      level: row.level,
      name: row.name,
      slug: row.slug,
      status: row.status,
    }))
  }

  async getPathString(tenantId, { separator = ' > ', includeIds = false, userId = null, client = null } = {}) {
    const cacheKey = CacheManager.key('path-string', tenantId, separator, includeIds)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const ancestors = await this.repository.findWithAncestors(tenantId, { userId, client })
    if (!ancestors) return ''
    const pathSegments = ancestors.ancestors?.map(item => ({
      id: item.id,
      name: item.name,
    })) || []
    const pathString = formatPathString(pathSegments, { separator, includeIds })
    this.cache.set(cacheKey, pathString, 120)
    return pathString
  }

  async findByType(tenantType, { filters = {}, userId = null, client = null } = {}) {
    return this.repository.findByFilters({
      filters: { ...filters, tenantType },
      userId,
      client,
    })
  }

  async findByLevel(level, { filters = {}, userId = null, client = null } = {}) {
    return this.repository.findByFilters({
      filters: { ...filters, level },
      userId,
      client,
    })
  }

  async findInSubtree(rootId, { filters = {}, userId = null, client = null } = {}) {
    const values = [rootId]
    const conditions = [`path @> ARRAY[$1]::uuid[]`]

    if (filters.status) {
      values.push(filters.status)
      conditions.push(`status = $${values.length}`)
    } else {
      conditions.push(`status != 'archived'`)
    }
    if (filters.tenantType) {
      values.push(filters.tenantType)
      conditions.push(`tenant_type = $${values.length}`)
    }
    if (filters.levelOffset !== undefined) {
      values.push(filters.levelOffset)
      conditions.push(`level = (SELECT level FROM tenants WHERE id = $1) + $${values.length}`)
    }

    const result = await this.repository.query({
      text: `
        SELECT *
        FROM tenants
        WHERE ${conditions.join(' AND ')}
        ORDER BY level ASC, name ASC
      `,
      values,
      userId,
      client,
    })
    return result.rows.map(row => ({
      id: row.id,
      parentId: row.parent_tenant_id,
      tenantType: row.tenant_type,
      level: row.level,
      path: row.path,
      name: row.name,
      slug: row.slug,
      status: row.status,
    }))
  }

  async getCommonAncestor(tenantId1, tenantId2, { userId = null, client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT ancestor.id, ancestor.name, ancestor.slug, ancestor.level
        FROM tenants t1
        JOIN tenants t2 ON true
        JOIN tenants ancestor ON ancestor.id = ANY(t1.path) AND ancestor.id = ANY(t2.path)
        WHERE t1.id = $1 AND t2.id = $2
        ORDER BY ancestor.level DESC
        LIMIT 1
      `,
      values: [tenantId1, tenantId2],
      userId,
      client,
    })
    return result.rows[0] || null
  }

  async getRelationship(tenantId1, tenantId2, options = {}) {
    if (tenantId1 === tenantId2) return 'same'
    const [ancestor, descendant] = await Promise.all([
      this.repository.findById(tenantId1, options),
      this.repository.findById(tenantId2, options),
    ])
    if (!ancestor || !descendant) return 'unknown'
    const distance = getPathDistance(ancestor.path, descendant.path)
    if (distance === 1) return 'parent'
    if (distance > 1) return 'ancestor'
    const reverse = getPathDistance(descendant.path, ancestor.path)
    if (reverse === 1) return 'child'
    if (reverse > 1) return 'descendant'

    if (ancestor.parentId && ancestor.parentId === descendant.parentId) {
      return 'sibling'
    }

    return 'unrelated'
  }

  async getTenantDistance(tenantId1, tenantId2, options = {}) {
    const [tenant1, tenant2] = await Promise.all([
      this.repository.findById(tenantId1, options),
      this.repository.findById(tenantId2, options),
    ])
    if (!tenant1 || !tenant2) return null
    if (tenant1.id === tenant2.id) return 0
    const distance = getPathDistance(tenant1.path, tenant2.path)
    if (distance !== null) return distance

    const reverse = getPathDistance(tenant2.path, tenant1.path)
    if (reverse !== null) return reverse

    const commonAncestor = await this.getCommonAncestor(tenantId1, tenantId2, options)
    if (!commonAncestor) return null
    return (
      getPathDistance(commonAncestor.path, tenant1.path) +
      getPathDistance(commonAncestor.path, tenant2.path)
    )
  }

  async validatePaths({ userId = null, client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT id, parent_tenant_id, level, path
        FROM tenants
      `,
      userId,
      client,
    })
    const inconsistencies = []
    for (const row of result.rows) {
      if (!Array.isArray(row.path) || row.path.length === 0) {
        inconsistencies.push({ id: row.id, issue: 'empty_path' })
        continue
      }
      if (row.path[row.path.length - 1] !== row.id) {
        inconsistencies.push({ id: row.id, issue: 'path_missing_self' })
      }
      if (row.parent_tenant_id) {
        if (!row.path.includes(row.parent_tenant_id)) {
          inconsistencies.push({ id: row.id, issue: 'missing_parent_in_path' })
        }
        if (row.level <= 0) {
          inconsistencies.push({ id: row.id, issue: 'invalid_level' })
        }
      } else if (row.level !== 0) {
        inconsistencies.push({ id: row.id, issue: 'root_level_mismatch' })
      }
    }
    return {
      total: result.rowCount,
      inconsistencies,
      isHealthy: inconsistencies.length === 0,
    }
  }

  async rebuildPaths(rootId, { userId = null } = {}) {
    return this.repository.transaction({ userId }, async client => {
      const tree = await this.repository.query({
        text: `
          SELECT *
          FROM tenants
          WHERE path @> ARRAY[$1]::uuid[]
          ORDER BY array_length(path, 1) ASC
        `,
        values: [rootId],
        client,
        userId,
      })

      const parents = new Map()
      for (const row of tree.rows) {
        parents.set(row.id, {
          id: row.id,
          parentId: row.parent_tenant_id,
          level: row.level,
          path: row.path,
        })
      }

      const updates = []
      for (const row of tree.rows) {
        let path
        let level
        if (!row.parent_tenant_id) {
          path = [row.id]
          level = 0
        } else {
          const parent = parents.get(row.parent_tenant_id)
          path = [...(parent?.path || []), row.id]
          level = (parent?.level ?? -1) + 1
        }
        updates.push({
          id: row.id,
          path,
          level,
        })
      }

      for (const update of updates) {
        await this.repository.query({
          text: `
            UPDATE tenants
            SET path = $2,
                level = $3,
                updated_at = NOW()
            WHERE id = $1
          `,
          values: [update.id, update.path, update.level],
          client,
          userId,
        })
      }

      return { updated: updates.length }
    })
  }
}

export default PathService
