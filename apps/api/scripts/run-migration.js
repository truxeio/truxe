#!/usr/bin/env node

/**
 * RBAC Schema Migration Runner
 * 
 * Runs the RBAC schema migration against the development database
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '21432',
  database: process.env.DB_NAME || 'truxe.io',
  user: process.env.DB_USER || 'heimdall',
  password: process.env.DB_PASSWORD || 'dev_password_change_me'
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function runMigration() {
  try {
    colorLog('cyan', '🚀 Running RBAC Schema Migration...')
    
    // Construct psql command
    const migrationFile = join(__dirname, '../database/migrations/031_rbac_schema.sql')
    const command = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f "${migrationFile}"`
    
    colorLog('blue', `📁 Migration file: ${migrationFile}`)
    colorLog('blue', `🔗 Database: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)
    
    // Read migration file to show what will be executed
    const migrationContent = readFileSync(migrationFile, 'utf8')
    const tableMatches = migrationContent.match(/CREATE TABLE[^;]+;/g) || []
    
    colorLog('yellow', `📊 Will create ${tableMatches.length} tables:`)
    tableMatches.forEach(table => {
      const tableName = table.match(/CREATE TABLE[^(]+\(([^)]+)/)?.[0]?.match(/CREATE TABLE[^(]+/)?.[0]?.replace('CREATE TABLE IF NOT EXISTS ', '').replace('CREATE TABLE ', '').trim()
      if (tableName) {
        colorLog('yellow', `  - ${tableName}`)
      }
    })
    
    // Execute migration
    colorLog('blue', '\n⚙️ Executing migration...')
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    })
    
    // Check for success indicators in output
    if (output.includes('RBAC schema migration completed successfully')) {
      colorLog('green', '✅ RBAC schema migration completed successfully!')
      
      // Show created objects
      if (output.includes('Created tables:')) {
        const tables = output.match(/Created tables: ([^\n]+)/)?.[1]
        colorLog('green', `📊 Created tables: ${tables}`)
      }
      
      if (output.includes('Enhanced permissions table')) {
        colorLog('green', '🔧 Enhanced permissions table with ABAC columns')
      }
      
      if (output.includes('Added performance indexes')) {
        colorLog('green', '⚡ Added performance indexes and triggers')
      }
      
      if (output.includes('Inserted default system roles')) {
        colorLog('green', '👥 Inserted default system roles for all tenants')
      }
      
    } else {
      colorLog('green', '✅ Migration executed successfully!')
    }
    
    // Show any notices or output
    if (output.trim()) {
      colorLog('blue', '\n📝 Migration output:')
      console.log(output)
    }
    
  } catch (error) {
    colorLog('red', '❌ Migration failed!')
    
    if (error.stdout) {
      colorLog('blue', '\n📝 Output:')
      console.log(error.stdout)
    }
    
    if (error.stderr) {
      colorLog('red', '\n🚨 Error details:')
      console.error(error.stderr)
    }
    
    colorLog('red', `\n💡 Error: ${error.message}`)
    
    // Provide troubleshooting tips
    colorLog('yellow', '\n🔧 Troubleshooting tips:')
    colorLog('yellow', '1. Check database connection settings')
    colorLog('yellow', '2. Ensure PostgreSQL is running on the specified port')
    colorLog('yellow', '3. Verify user has CREATE TABLE permissions')
    colorLog('yellow', '4. Check if tables already exist')
    
    process.exit(1)
  }
}

// Show help if requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  colorLog('cyan', 'RBAC Schema Migration Runner')
  console.log('\nUsage: node run-migration.js [options]')
  console.log('\nOptions:')
  console.log('  --help, -h    Show this help message')
  console.log('\nEnvironment Variables:')
  console.log('  DB_HOST       Database host (default: localhost)')
  console.log('  DB_PORT       Database port (default: 21432)')
  console.log('  DB_NAME       Database name (default: truxe.io)')
  console.log('  DB_USER       Database user (default: heimdall)')
  console.log('  DB_PASSWORD   Database password (default: dev_password_change_me)')
  process.exit(0)
}

// Run migration
runMigration().catch(error => {
  colorLog('red', `Fatal error: ${error.message}`)
  process.exit(1)
})