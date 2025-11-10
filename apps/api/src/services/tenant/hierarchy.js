/**
 * Hierarchy Service
 *
 * Provides traversal helpers for navigating the tenant hierarchy using the
 * materialized path column for performant ancestor/descendant queries.
 */

import TenantRepository from './repository.js'
import CacheManager from './utils/cache-manager.js'

function mapRowsToTree(rows) {
  const nodes = new Map()
  const rootNodes = []

  rows.forEach(row => {
    const node = {
      id: row.id,
      parentId: row.parent_tenant_id,
      tenantType: row.tenant_type,
      level: row.level,
      path: row.path,
      maxDepth: row.max_depth,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      settings: row.settings || {},
      metadata: row.metadata || {},
      children: [],
    }
    nodes.set(node.id, node)
  })

  nodes.forEach(node => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId).children.push(node)
    } else {
      rootNodes.push(node)
    }
  })

  return rootNodes
}

export class HierarchyService {
  constructor({
    repository = new TenantRepository(),
    cache = new CacheManager({ ttl: 120 }),
  } = {}) {
    this.repository = repository
    this.cache = cache
  }

  async getParent(tenantId, { userId = null, client = null } = {}) {
    const tenant = await this.repository.findById(tenantId, { userId, client, includeArchived: true })
    if (!tenant || !tenant.parentId) return null
    return this.repository.findById(tenant.parentId, { userId, client })
  }

  async getChildren(tenantId, { filters = {}, userId = null, client = null } = {}) {
    const cacheKey = CacheManager.key('children', tenantId, filters.status || 'all')
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const values = [tenantId]
    const where = ['parent_tenant_id = $1']

    if (filters.status) {
      values.push(filters.status)
      where.push(`status = $${values.length}`)
    } else {
      where.push(`status != 'archived'`)
    }
    if (filters.tenantType) {
      values.push(filters.tenantType)
      where.push(`tenant_type = $${values.length}`)
    }

    const result = await this.repository.query({
      text: `
        SELECT *
        FROM tenants
        WHERE ${where.join(' AND ')}
        ORDER BY name ASC
      `,
      values,
      userId,
      client,
    })

    const children = result.rows.map(row => ({
      id: row.id,
      parentId: row.parent_tenant_id,
      tenantType: row.tenant_type,
      level: row.level,
      path: row.path,
      maxDepth: row.max_depth,
      name: row.name,
      slug: row.slug,
      status: row.status,
      settings: row.settings || {},
    }))

    this.cache.set(cacheKey, children)
    return children
  }

  async getSiblings(tenantId, { userId = null, client = null } = {}) {
    const tenant = await this.repository.findById(tenantId, { userId, client, includeArchived: true })
    if (!tenant) return []
    const parentId = tenant.parentId
    if (!parentId) {
      // Root siblings: other root tenants
      return this.repository.findByFilters({
        filters: { level: 0 },
        userId,
        client,
      }).then(tenants => tenants.filter(item => item.id !== tenantId))
    }
    const siblings = await this.getChildren(parentId, { userId, client })
    return siblings.filter(sibling => sibling.id !== tenantId)
  }

  async getRoot(tenantId, { userId = null, client = null } = {}) {
    const tenant = await this.repository.findById(tenantId, { userId, client, includeArchived: true })
    if (!tenant) return null
    if (tenant.level === 0) return tenant

    const rootId = tenant.path?.[0]
    if (!rootId) return null
    return this.repository.findById(rootId, { userId, client })
  }

  async getAncestors(tenantId, { userId = null, client = null } = {}) {
    const cacheKey = CacheManager.key('ancestors', tenantId)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const result = await this.repository.query({
      text: `
        SELECT ancestor.*
        FROM tenants descendant
        JOIN tenants ancestor ON ancestor.id = ANY(descendant.path)
        WHERE descendant.id = $1
        ORDER BY array_position(descendant.path, ancestor.id)
      `,
      values: [tenantId],
      userId,
      client,
    })

    const ancestors = result.rows.map(row => ({
      id: row.id,
      tenantType: row.tenant_type,
      level: row.level,
      name: row.name,
      slug: row.slug,
      status: row.status,
    }))
    this.cache.set(cacheKey, ancestors)
    return ancestors
  }

  async getAncestorChain(tenantId, options = {}) {
    return this.getAncestors(tenantId, options)
  }

  async getDescendants(tenantId, maxDepth = null, { userId = null, client = null } = {}) {
    const cacheKey = CacheManager.key('descendants', tenantId, maxDepth ?? 'all')
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const values = [tenantId]
    const depthClause = maxDepth !== null
      ? `AND descendant.level <= ancestor.level + $2`
      : ''
    if (maxDepth !== null) values.push(maxDepth)

    const result = await this.repository.query({
      text: `
        SELECT descendant.*
        FROM tenants ancestor
        JOIN tenants descendant ON descendant.path @> ARRAY[ancestor.id]
        WHERE ancestor.id = $1 AND descendant.id != ancestor.id
        ${depthClause}
        ORDER BY descendant.level ASC
      `,
      values,
      userId,
      client,
    })

    const descendants = result.rows.map(row => ({
      id: row.id,
      parentId: row.parent_tenant_id,
      tenantType: row.tenant_type,
      level: row.level,
      path: row.path,
      name: row.name,
      slug: row.slug,
      status: row.status,
    }))

    this.cache.set(cacheKey, descendants, 60)
    return descendants
  }

  async getLevel(tenantId, { userId = null, client = null } = {}) {
    const cacheKey = CacheManager.key('level', tenantId)
    const cached = this.cache.get(cacheKey)
    if (cached !== null) return cached

    const result = await this.repository.query({
      text: 'SELECT level FROM tenants WHERE id = $1',
      values: [tenantId],
      userId,
      client,
    })
    if (result.rowCount === 0) return null
    const level = Number(result.rows[0].level)
    this.cache.set(cacheKey, level, 120)
    return level
  }

  async getDepth(tenantId, { userId = null, client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT MAX(descendant.level) - ancestor.level AS depth
        FROM tenants ancestor
        JOIN tenants descendant ON descendant.path @> ARRAY[ancestor.id]
        WHERE ancestor.id = $1
      `,
      values: [tenantId],
      userId,
      client,
    })
    if (result.rowCount === 0) return 0
    return Number(result.rows[0].depth || 0)
  }

  async getTenantCount(tenantId, { includeSelf = false, userId = null, client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT COUNT(*)::int AS descendant_count
        FROM tenants ancestor
        JOIN tenants descendant ON descendant.path @> ARRAY[ancestor.id]
        WHERE ancestor.id = $1
      `,
      values: [tenantId],
      userId,
      client,
    })
    let count = Number(result.rows[0]?.descendant_count || 0)
    if (!includeSelf) count -= 1
    return Math.max(count, 0)
  }

  async isAncestor(ancestorId, descendantId, { userId = null, client = null } = {}) {
    const result = await this.repository.query({
      text: `
        SELECT 1
        FROM tenants descendant
        WHERE descendant.id = $1
        AND $2 = ANY(descendant.path)
        LIMIT 1
      `,
      values: [descendantId, ancestorId],
      userId,
      client,
    })
    return result.rowCount > 0
  }

  async isDescendant(descendantId, ancestorId, options = {}) {
    return this.isAncestor(ancestorId, descendantId, options)
  }

  async getMultipleTenantTrees(tenantIds, { userId = null, client = null } = {}) {
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) return []

    const uniqueIds = [...new Set(tenantIds)]
    const result = await this.repository.query({
      text: `
        SELECT descendant.*
        FROM tenants descendant
        WHERE ${uniqueIds.map((_, index) => `$${index + 1} = ANY(descendant.path)`).join(' OR ')}
        ORDER BY descendant.level ASC
      `,
      values: uniqueIds,
      userId,
      client,
    })
    return mapRowsToTree(result.rows)
  }

  async getFullHierarchy(rootId, { userId = null, client = null } = {}) {
    const cacheKey = CacheManager.key('tree', rootId)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const result = await this.repository.query({
      text: `
        SELECT *
        FROM tenants
        WHERE path @> ARRAY[$1]::uuid[]
        ORDER BY array_length(path, 1) ASC
      `,
      values: [rootId],
      userId,
      client,
    })

    const tree = mapRowsToTree(result.rows)
    this.cache.set(cacheKey, tree, 60)
    return tree
  }
}

export default HierarchyService
