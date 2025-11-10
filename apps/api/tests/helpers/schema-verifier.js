/**
 * Database Schema Verifier
 * 
 * Verifies that the database schema matches the expected structure
 * before running tests. Provides detailed error messages for missing
 * or incorrect schema elements.
 */

import { testDatabase } from './test-database.js'

/**
 * Expected schema definition for RBAC system
 */
const EXPECTED_SCHEMA = {
  users: {
    required: ['id', 'email', 'metadata', 'created_at', 'updated_at'],
    optional: ['password_hash', 'name', 'avatar_url']
  },
  tenants: {
    required: [
      'id', 'name', 'slug', 'tenant_type', 'level', 'path', 
      'status', 'metadata', 'created_at', 'updated_at'
    ],
    optional: ['parent_tenant_id', 'description', 'settings', 'archived_at', 'max_depth']
  },
  permissions: {
    required: [
      'id', 'user_id', 'tenant_id', 'resource_type', 'actions',
      'created_at', 'updated_at'
    ],
    optional: ['resource_id', 'conditions', 'granted_by', 'expires_at', 'block_inheritance']
  },
  policies: {
    required: [
      'id', 'name', 'tenant_id', 'conditions', 'effect', 
      'resources', 'actions', 'created_at', 'updated_at'
    ],
    optional: ['priority', 'enabled', 'created_by'],
    mustNotHave: ['description']  // Common mistake - this column does not exist
  },
  roles: {
    required: [
      'id', 'name', 'tenant_id', 'is_system', 'permissions',
      'created_at', 'updated_at'
    ],
    optional: ['description', 'inherits_from', 'created_by']
  },
  user_roles: {
    required: ['user_id', 'role_id', 'tenant_id', 'assigned_at'],
    optional: ['assigned_by', 'expires_at']
  },
  tenant_members: {
    required: [
      'id', 'tenant_id', 'user_id', 'role', 'permissions',
      'invited_at', 'created_at', 'updated_at'
    ],
    optional: ['invited_by', 'joined_at', 'inherited_from']
  },
  role_permissions: {
    required: ['role_id', 'permission_id', 'granted_at'],
    optional: ['granted_by']
  }
}

/**
 * Verify entire database schema
 */
export async function verifyDatabaseSchema(options = {}) {
  const { verbose = false, throwOnError = true } = options
  const errors = []
  const warnings = []
  const results = {
    tablesChecked: 0,
    columnsVerified: 0,
    errors: [],
    warnings: [],
    success: true
  }

  const client = await testDatabase.connect()

  try {
    if (verbose) {
      console.log('🔍 Starting database schema verification...\n')
    }

    // Check each expected table
    for (const [tableName, schema] of Object.entries(EXPECTED_SCHEMA)) {
      const tableResult = await verifyTable(client, tableName, schema, verbose)
      
      results.tablesChecked++
      results.columnsVerified += tableResult.columnsChecked

      if (tableResult.errors.length > 0) {
        errors.push(...tableResult.errors)
        results.errors.push(...tableResult.errors)
      }

      if (tableResult.warnings.length > 0) {
        warnings.push(...tableResult.warnings)
        results.warnings.push(...tableResult.warnings)
      }
    }

    // Check foreign key constraints
    const fkResult = await verifyForeignKeys(client, verbose)
    if (fkResult.errors.length > 0) {
      errors.push(...fkResult.errors)
      results.errors.push(...fkResult.errors)
    }

    // Final result
    if (errors.length > 0) {
      results.success = false
      
      if (verbose) {
        console.error('\n❌ Schema verification FAILED\n')
        console.error('Errors found:')
        errors.forEach(err => console.error(`  - ${err}`))
      }

      if (warnings.length > 0 && verbose) {
        console.warn('\nWarnings:')
        warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`))
      }

      if (throwOnError) {
        throw new Error(`Schema verification failed: ${errors.join('; ')}`)
      }
    } else {
      if (verbose) {
        console.log(`\n✅ Schema verification PASSED`)
        console.log(`   Tables checked: ${results.tablesChecked}`)
        console.log(`   Columns verified: ${results.columnsVerified}`)
        
        if (warnings.length > 0) {
          console.warn('\nWarnings:')
          warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`))
        }
      }
    }

    return results

  } finally {
    client.release()
  }
}

/**
 * Verify a single table
 */
async function verifyTable(client, tableName, schema, verbose = false) {
  const result = {
    errors: [],
    warnings: [],
    columnsChecked: 0
  }

  if (verbose) {
    console.log(`📋 Checking table: ${tableName}`)
  }

  // Check if table exists
  const tableExists = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  )

  if (!tableExists.rows[0].exists) {
    result.errors.push(`Table '${tableName}' does not exist`)
    return result
  }

  // Get all columns in the table
  const columnsResult = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns 
     WHERE table_name = $1 AND table_schema = 'public'
     ORDER BY ordinal_position`,
    [tableName]
  )

  const actualColumns = columnsResult.rows.map(row => ({
    name: row.column_name,
    type: row.data_type,
    nullable: row.is_nullable === 'YES'
  }))

  const actualColumnNames = actualColumns.map(col => col.name)

  // Check required columns
  for (const requiredColumn of schema.required) {
    result.columnsChecked++
    
    if (!actualColumnNames.includes(requiredColumn)) {
      result.errors.push(
        `Table '${tableName}' missing required column: ${requiredColumn}`
      )
    } else if (verbose) {
      console.log(`  ✓ ${requiredColumn}`)
    }
  }

  // Check columns that must not exist
  if (schema.mustNotHave) {
    for (const forbiddenColumn of schema.mustNotHave) {
      if (actualColumnNames.includes(forbiddenColumn)) {
        result.errors.push(
          `Table '${tableName}' has forbidden column: ${forbiddenColumn} (this column should not exist)`
        )
      }
    }
  }

  // Warn about unexpected columns
  const expectedColumns = [...schema.required, ...(schema.optional || [])]
  const forbiddenColumns = schema.mustNotHave || []
  
  for (const actualColumn of actualColumnNames) {
    if (!expectedColumns.includes(actualColumn) && !forbiddenColumns.includes(actualColumn)) {
      result.warnings.push(
        `Table '${tableName}' has unexpected column: ${actualColumn}`
      )
    }
  }

  return result
}

/**
 * Verify critical foreign key constraints
 */
async function verifyForeignKeys(client, verbose = false) {
  const result = {
    errors: [],
    warnings: []
  }

  if (verbose) {
    console.log('\n🔗 Checking foreign key constraints...')
  }

  const expectedForeignKeys = [
    {
      table: 'permissions',
      column: 'user_id',
      refTable: 'users',
      refColumn: 'id'
    },
    {
      table: 'permissions',
      column: 'tenant_id',
      refTable: 'tenants',
      refColumn: 'id'
    },
    {
      table: 'policies',
      column: 'tenant_id',
      refTable: 'tenants',
      refColumn: 'id'
    },
    {
      table: 'user_roles',
      column: 'user_id',
      refTable: 'users',
      refColumn: 'id'
    },
    {
      table: 'user_roles',
      column: 'role_id',
      refTable: 'roles',
      refColumn: 'id'
    },
    {
      table: 'user_roles',
      column: 'tenant_id',
      refTable: 'tenants',
      refColumn: 'id'
    },
    {
      table: 'tenant_members',
      column: 'user_id',
      refTable: 'users',
      refColumn: 'id'
    },
    {
      table: 'tenant_members',
      column: 'tenant_id',
      refTable: 'tenants',
      refColumn: 'id'
    }
  ]

  for (const fk of expectedForeignKeys) {
    const fkExists = await client.query(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
          AND kcu.column_name = $2
          AND ccu.table_name = $3
          AND ccu.column_name = $4
      )`,
      [fk.table, fk.column, fk.refTable, fk.refColumn]
    )

    if (!fkExists.rows[0].exists) {
      result.errors.push(
        `Missing foreign key: ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}`
      )
    } else if (verbose) {
      console.log(`  ✓ ${fk.table}.${fk.column} -> ${fk.refTable}.${fk.refColumn}`)
    }
  }

  return result
}

/**
 * Run quick schema check (used by test helper)
 */
export async function quickSchemaCheck() {
  try {
    await verifyDatabaseSchema({ verbose: false, throwOnError: true })
    return true
  } catch (error) {
    console.error('Schema verification failed:', error.message)
    return false
  }
}

/**
 * Generate schema documentation
 */
export async function generateSchemaDocumentation() {
  const client = await testDatabase.connect()
  const docs = []

  try {
    for (const [tableName, schema] of Object.entries(EXPECTED_SCHEMA)) {
      docs.push(`\n## Table: ${tableName}`)
      docs.push('\n### Required Columns:')
      schema.required.forEach(col => docs.push(`- ${col}`))
      
      if (schema.optional && schema.optional.length > 0) {
        docs.push('\n### Optional Columns:')
        schema.optional.forEach(col => docs.push(`- ${col}`))
      }

      if (schema.mustNotHave && schema.mustNotHave.length > 0) {
        docs.push('\n### Forbidden Columns:')
        schema.mustNotHave.forEach(col => docs.push(`- ${col} (should not exist)`))
      }
    }

    return docs.join('\n')

  } finally {
    client.release()
  }
}

export default {
  verifyDatabaseSchema,
  quickSchemaCheck,
  generateSchemaDocumentation,
  EXPECTED_SCHEMA
}
