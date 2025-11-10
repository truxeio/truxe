#!/usr/bin/env node

/**
 * Configuration Migration Tool
 * 
 * This script helps migrate hardcoded configuration values to environment variables
 * and configuration constants. It can automatically update files and generate
 * migration reports.
 * 
 * @author Wundam LLC
 * @version 1.0.0
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ALL_CONSTANTS } from '../src/config/constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Configuration Migration Tool
 */
class ConfigMigrator {
  constructor() {
    this.migrations = []
    this.backupDir = path.join(__dirname, '../backups')
    this.ensureBackupDir()
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
  }

  /**
   * Create backup of file
   */
  createBackup(filePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = path.basename(filePath)
    const backupPath = path.join(this.backupDir, `${fileName}.${timestamp}.backup`)
    
    try {
      fs.copyFileSync(filePath, backupPath)
      console.log(`✅ Backup created: ${backupPath}`)
      return backupPath
    } catch (error) {
      console.error(`❌ Failed to create backup: ${error.message}`)
      return null
    }
  }

  /**
   * Migrate hardcoded values in a file
   */
  migrateFile(filePath, options = {}) {
    const { dryRun = false, createBackup = true } = options
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      return false
    }

    console.log(`\n🔄 Migrating: ${filePath}`)
    
    if (createBackup && !dryRun) {
      this.createBackup(filePath)
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8')
      const originalContent = content
      
      // Apply migrations
      content = this.migratePorts(content, filePath)
      content = this.migrateUrls(content, filePath)
      content = this.migrateTimeouts(content, filePath)
      content = this.migrateColors(content, filePath)
      content = this.migrateSizes(content, filePath)
      content = this.migrateDatabaseConfigs(content, filePath)
      content = this.migrateRedisConfigs(content, filePath)
      content = this.migrateJWTConfigs(content, filePath)
      content = this.migrateEmailConfigs(content, filePath)
      content = this.migrateSecurityConfigs(content, filePath)
      content = this.migrateRateLimitConfigs(content, filePath)
      content = this.migrateMonitoringConfigs(content, filePath)

      if (content !== originalContent) {
        if (dryRun) {
          console.log(`📝 Would update: ${filePath}`)
          console.log('Changes preview:')
          console.log(this.generateDiff(originalContent, content))
        } else {
          fs.writeFileSync(filePath, content, 'utf8')
          console.log(`✅ Updated: ${filePath}`)
        }
        return true
      } else {
        console.log(`ℹ️  No changes needed: ${filePath}`)
        return false
      }
    } catch (error) {
      console.error(`❌ Migration failed: ${error.message}`)
      return false
    }
  }

  /**
   * Migrate port numbers
   */
  migratePorts(content, filePath) {
    const portMappings = {
      '3001': 'APP_CONSTANTS.DEFAULT_PORT',
      '21001': 'PORT_CONSTANTS.DEV_API_PORT',
      '21432': 'PORT_CONSTANTS.DEV_DATABASE_PORT',
      '21379': 'PORT_CONSTANTS.DEV_REDIS_PORT',
      '21025': 'PORT_CONSTANTS.DEV_MAILHOG_SMTP_PORT',
      '21825': 'PORT_CONSTANTS.DEV_MAILHOG_WEB_PORT',
      '21002': 'PORT_CONSTANTS.DEV_DOCS_PORT',
      '21003': 'PORT_CONSTANTS.DEV_MONITORING_PORT',
      '21004': 'PORT_CONSTANTS.DEV_GRAFANA_PORT',
      '21005': 'PORT_CONSTANTS.DEV_PROMETHEUS_PORT',
      '5432': 'PORT_CONSTANTS.PROD_DATABASE_PORT',
      '6379': 'PORT_CONSTANTS.PROD_REDIS_PORT',
      '80': 'PORT_CONSTANTS.PROD_API_PORT',
      '443': 'PORT_CONSTANTS.PROD_HTTPS_PORT'
    }

    let updated = content
    Object.entries(portMappings).forEach(([port, constant]) => {
      const regex = new RegExp(`\\b${port}\\b`, 'g')
      if (updated.includes(port) && !updated.includes(constant)) {
        updated = updated.replace(regex, constant)
        this.migrations.push({
          type: 'port',
          oldValue: port,
          newValue: constant,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate URLs
   */
  migrateUrls(content, filePath) {
    const urlMappings = {
      'http://localhost:3000': 'MAGIC_LINK_CONSTANTS.DEFAULT_BASE_URL',
      'http://localhost:3001': 'process.env.API_URL || "http://localhost:3001"',
      'http://localhost:21001': 'process.env.API_URL || "http://localhost:21001"',
      'redis://localhost:6379': 'REDIS_CONSTANTS.DEFAULT_URL',
      'postgresql://username:password@localhost:5432/truxe.io': 'process.env.DATABASE_URL'
    }

    let updated = content
    Object.entries(urlMappings).forEach(([url, replacement]) => {
      if (updated.includes(url) && !updated.includes(replacement)) {
        updated = updated.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement)
        this.migrations.push({
          type: 'url',
          oldValue: url,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate timeout values
   */
  migrateTimeouts(content, filePath) {
    const timeoutMappings = {
      '15m': 'JWT_CONSTANTS.DEFAULT_ACCESS_TOKEN_TTL',
      '30d': 'JWT_CONSTANTS.DEFAULT_REFRESH_TOKEN_TTL',
      '10s': 'DATABASE_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT',
      '30s': 'DATABASE_CONSTANTS.DEFAULT_STATEMENT_TIMEOUT',
      '1h': 'SECURITY_CONSTANTS.DEFAULT_SESSION_CLEANUP_INTERVAL',
      '5m': 'MAGIC_LINK_CONSTANTS.DEFAULT_TTL',
      '1m': 'RATE_LIMIT_CONSTANTS.MAGIC_LINK_WINDOW_IP'
    }

    let updated = content
    Object.entries(timeoutMappings).forEach(([timeout, constant]) => {
      const regex = new RegExp(`'${timeout}'`, 'g')
      if (updated.includes(`'${timeout}'`) && !updated.includes(constant)) {
        updated = updated.replace(regex, constant)
        this.migrations.push({
          type: 'timeout',
          oldValue: `'${timeout}'`,
          newValue: constant,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate color values
   */
  migrateColors(content, filePath) {
    const colorMappings = {
      '#007bff': 'UI_CONSTANTS.PRIMARY_COLOR',
      '#0056b3': 'UI_CONSTANTS.PRIMARY_COLOR_HOVER',
      '#28a745': 'UI_CONSTANTS.SUCCESS_COLOR',
      '#218838': 'UI_CONSTANTS.SUCCESS_COLOR_HOVER',
      '#fff3cd': 'UI_CONSTANTS.WARNING_COLOR',
      '#ffeaa7': 'UI_CONSTANTS.WARNING_BORDER_COLOR',
      '#333': 'UI_CONSTANTS.TEXT_COLOR',
      '#666': 'UI_CONSTANTS.MUTED_TEXT_COLOR',
      '#f8f9fa': 'UI_CONSTANTS.BACKGROUND_COLOR'
    }

    let updated = content
    Object.entries(colorMappings).forEach(([color, constant]) => {
      const regex = new RegExp(color.replace('#', '\\#'), 'g')
      if (updated.includes(color) && !updated.includes(constant)) {
        updated = updated.replace(regex, constant)
        this.migrations.push({
          type: 'color',
          oldValue: color,
          newValue: constant,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate size values
   */
  migrateSizes(content, filePath) {
    const sizeMappings = {
      '600px': 'UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH',
      '20px': 'UI_CONSTANTS.EMAIL_CONTAINER_PADDING',
      '40px': 'UI_CONSTANTS.EMAIL_HEADER_MARGIN_BOTTOM',
      '24px': 'UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE',
      '30px': 'UI_CONSTANTS.EMAIL_CONTENT_PADDING',
      '12px 24px': 'UI_CONSTANTS.EMAIL_BUTTON_PADDING',
      '14px': 'UI_CONSTANTS.EMAIL_FOOTER_FONT_SIZE',
      '15px': 'UI_CONSTANTS.EMAIL_SECURITY_NOTE_PADDING',
      '8px': 'UI_CONSTANTS.BORDER_RADIUS',
      '6px': 'UI_CONSTANTS.BUTTON_BORDER_RADIUS',
      '4px': 'UI_CONSTANTS.SECURITY_NOTE_BORDER_RADIUS'
    }

    let updated = content
    Object.entries(sizeMappings).forEach(([size, constant]) => {
      const regex = new RegExp(size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      if (updated.includes(size) && !updated.includes(constant)) {
        updated = updated.replace(regex, constant)
        this.migrations.push({
          type: 'size',
          oldValue: size,
          newValue: constant,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate database configurations
   */
  migrateDatabaseConfigs(content, filePath) {
    const dbMappings = {
      'parseInteger(process.env.DATABASE_POOL_MIN, 2)': 'parseInteger(process.env.DATABASE_POOL_MIN, DATABASE_CONSTANTS.DEFAULT_POOL_MIN)',
      'parseInteger(process.env.DATABASE_POOL_MAX, 10)': 'parseInteger(process.env.DATABASE_POOL_MAX, DATABASE_CONSTANTS.DEFAULT_POOL_MAX)',
      'parseDuration(process.env.DATABASE_CONNECTION_TIMEOUT || \'10s\')': 'parseDuration(process.env.DATABASE_CONNECTION_TIMEOUT || DATABASE_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT)',
      'parseDuration(process.env.DATABASE_STATEMENT_TIMEOUT || \'30s\')': 'parseDuration(process.env.DATABASE_STATEMENT_TIMEOUT || DATABASE_CONSTANTS.DEFAULT_STATEMENT_TIMEOUT)'
    }

    let updated = content
    Object.entries(dbMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'database',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate Redis configurations
   */
  migrateRedisConfigs(content, filePath) {
    const redisMappings = {
      'process.env.REDIS_URL || \'redis://localhost:6379\'': 'process.env.REDIS_URL || REDIS_CONSTANTS.DEFAULT_URL',
      'process.env.REDIS_KEY_PREFIX || \'heimdall:\'': 'process.env.REDIS_KEY_PREFIX || REDIS_CONSTANTS.DEFAULT_KEY_PREFIX',
      'parseInteger(process.env.REDIS_RETRY_DELAY, 100)': 'parseInteger(process.env.REDIS_RETRY_DELAY, REDIS_CONSTANTS.DEFAULT_RETRY_DELAY)',
      'parseInteger(process.env.REDIS_MAX_RETRIES, 3)': 'parseInteger(process.env.REDIS_MAX_RETRIES, REDIS_CONSTANTS.DEFAULT_MAX_RETRIES)'
    }

    let updated = content
    Object.entries(redisMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'redis',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate JWT configurations
   */
  migrateJWTConfigs(content, filePath) {
    const jwtMappings = {
      'process.env.JWT_ALGORITHM || \'RS256\'': 'process.env.JWT_ALGORITHM || JWT_CONSTANTS.DEFAULT_ALGORITHM',
      'process.env.JWT_AUDIENCE || \'truxe-api\'': 'process.env.JWT_AUDIENCE || JWT_CONSTANTS.DEFAULT_AUDIENCE',
      'parseDuration(process.env.JWT_ACCESS_TOKEN_TTL || \'15m\')': 'parseDuration(process.env.JWT_ACCESS_TOKEN_TTL || JWT_CONSTANTS.DEFAULT_ACCESS_TOKEN_TTL)',
      'parseDuration(process.env.JWT_REFRESH_TOKEN_TTL || \'30d\')': 'parseDuration(process.env.JWT_REFRESH_TOKEN_TTL || JWT_CONSTANTS.DEFAULT_REFRESH_TOKEN_TTL)',
      'process.env.JWT_KEY_ID || \'truxe-rsa-2025\'': 'process.env.JWT_KEY_ID || JWT_CONSTANTS.DEFAULT_KEY_ID'
    }

    let updated = content
    Object.entries(jwtMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'jwt',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate email configurations
   */
  migrateEmailConfigs(content, filePath) {
    const emailMappings = {
      'process.env.EMAIL_PROVIDER || \'resend\'': 'process.env.EMAIL_PROVIDER || EMAIL_CONSTANTS.DEFAULT_PROVIDER',
      'process.env.EMAIL_FROM || \'noreply@truxe.io\'': 'process.env.EMAIL_FROM || EMAIL_CONSTANTS.DEFAULT_FROM',
      'process.env.EMAIL_FROM_NAME || \'Heimdall Auth\'': 'process.env.EMAIL_FROM_NAME || EMAIL_CONSTANTS.DEFAULT_FROM_NAME',
      'parseInteger(process.env.SMTP_PORT, 587)': 'parseInteger(process.env.SMTP_PORT, EMAIL_CONSTANTS.DEFAULT_SMTP_PORT)',
      'parseBoolean(process.env.SMTP_SECURE, false)': 'parseBoolean(process.env.SMTP_SECURE, EMAIL_CONSTANTS.DEFAULT_SMTP_SECURE)',
      'process.env.AWS_REGION || \'us-east-1\'': 'process.env.AWS_REGION || EMAIL_CONSTANTS.DEFAULT_AWS_REGION'
    }

    let updated = content
    Object.entries(emailMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'email',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate security configurations
   */
  migrateSecurityConfigs(content, filePath) {
    const securityMappings = {
      'parseInteger(process.env.BCRYPT_ROUNDS, 12)': 'parseInteger(process.env.BCRYPT_ROUNDS, SECURITY_CONSTANTS.DEFAULT_BCRYPT_ROUNDS)',
      'process.env.CORS_ORIGIN || \'http://localhost:3000\'': 'process.env.CORS_ORIGIN || SECURITY_CONSTANTS.DEFAULT_CORS_ORIGIN',
      'parseBoolean(process.env.CORS_CREDENTIALS, true)': 'parseBoolean(process.env.CORS_CREDENTIALS, SECURITY_CONSTANTS.DEFAULT_CORS_CREDENTIALS)',
      'parseInteger(process.env.MAX_CONCURRENT_SESSIONS, 5)': 'parseInteger(process.env.MAX_CONCURRENT_SESSIONS, SECURITY_CONSTANTS.DEFAULT_MAX_CONCURRENT_SESSIONS)',
      'parseDuration(process.env.SESSION_CLEANUP_INTERVAL || \'1h\')': 'parseDuration(process.env.SESSION_CLEANUP_INTERVAL || SECURITY_CONSTANTS.DEFAULT_SESSION_CLEANUP_INTERVAL)',
      'parseBoolean(process.env.SESSION_EXTEND_ON_USE, true)': 'parseBoolean(process.env.SESSION_EXTEND_ON_USE, SECURITY_CONSTANTS.DEFAULT_SESSION_EXTEND_ON_USE)'
    }

    let updated = content
    Object.entries(securityMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'security',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate rate limit configurations
   */
  migrateRateLimitConfigs(content, filePath) {
    const rateLimitMappings = {
      'parseInteger(process.env.RATE_LIMIT_MAGIC_LINK_PER_IP, 5)': 'parseInteger(process.env.RATE_LIMIT_MAGIC_LINK_PER_IP, RATE_LIMIT_CONSTANTS.MAGIC_LINK_PER_IP)',
      'parseDuration(process.env.RATE_LIMIT_MAGIC_LINK_WINDOW || \'1m\')': 'parseDuration(process.env.RATE_LIMIT_MAGIC_LINK_WINDOW || RATE_LIMIT_CONSTANTS.MAGIC_LINK_WINDOW_IP)',
      'parseInteger(process.env.RATE_LIMIT_MAGIC_LINK_PER_EMAIL, 3)': 'parseInteger(process.env.RATE_LIMIT_MAGIC_LINK_PER_EMAIL, RATE_LIMIT_CONSTANTS.MAGIC_LINK_PER_EMAIL)',
      'parseDuration(process.env.RATE_LIMIT_MAGIC_LINK_EMAIL_WINDOW || \'1h\')': 'parseDuration(process.env.RATE_LIMIT_MAGIC_LINK_EMAIL_WINDOW || RATE_LIMIT_CONSTANTS.MAGIC_LINK_WINDOW_EMAIL)',
      'parseInteger(process.env.RATE_LIMIT_GLOBAL_MAX, 1000)': 'parseInteger(process.env.RATE_LIMIT_GLOBAL_MAX, RATE_LIMIT_CONSTANTS.GLOBAL_MAX)',
      'parseDuration(process.env.RATE_LIMIT_GLOBAL_WINDOW || \'1h\')': 'parseDuration(process.env.RATE_LIMIT_GLOBAL_WINDOW || RATE_LIMIT_CONSTANTS.GLOBAL_WINDOW)'
    }

    let updated = content
    Object.entries(rateLimitMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'rate_limit',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Migrate monitoring configurations
   */
  migrateMonitoringConfigs(content, filePath) {
    const monitoringMappings = {
      'parseInteger(process.env.SECURITY_MONITORING_METRICS_RETENTION, 30)': 'parseInteger(process.env.SECURITY_MONITORING_METRICS_RETENTION, MONITORING_CONSTANTS.DEFAULT_METRICS_RETENTION)',
      'parseInteger(process.env.SECURITY_MONITORING_DASHBOARD_REFRESH, 30000)': 'parseInteger(process.env.SECURITY_MONITORING_DASHBOARD_REFRESH, MONITORING_CONSTANTS.DEFAULT_DASHBOARD_REFRESH)',
      'parseBoolean(process.env.SECURITY_MONITORING_REAL_TIME_ALERTS, true)': 'parseBoolean(process.env.SECURITY_MONITORING_REAL_TIME_ALERTS, MONITORING_CONSTANTS.DEFAULT_REAL_TIME_ALERTS)'
    }

    let updated = content
    Object.entries(monitoringMappings).forEach(([old, replacement]) => {
      if (updated.includes(old) && !updated.includes(replacement)) {
        updated = updated.replace(old, replacement)
        this.migrations.push({
          type: 'monitoring',
          oldValue: old,
          newValue: replacement,
          file: filePath
        })
      }
    })

    return updated
  }

  /**
   * Generate diff between old and new content
   */
  generateDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n')
    const newLines = newContent.split('\n')
    const diff = []

    const maxLines = Math.max(oldLines.length, newLines.length)
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || ''
      const newLine = newLines[i] || ''

      if (oldLine !== newLine) {
        diff.push(`- ${oldLine}`)
        diff.push(`+ ${newLine}`)
      }
    }

    return diff.join('\n')
  }

  /**
   * Generate migration report
   */
  generateReport() {
    console.log('\n📊 Migration Report')
    console.log('=' .repeat(50))

    const groupedMigrations = this.migrations.reduce((acc, migration) => {
      if (!acc[migration.type]) {
        acc[migration.type] = []
      }
      acc[migration.type].push(migration)
      return acc
    }, {})

    Object.entries(groupedMigrations).forEach(([type, migrations]) => {
      console.log(`\n${type.toUpperCase()} Migrations: ${migrations.length}`)
      migrations.forEach(migration => {
        console.log(`  • ${migration.oldValue} → ${migration.newValue}`)
        console.log(`    File: ${migration.file}`)
      })
    })

    console.log(`\nTotal Migrations: ${this.migrations.length}`)
  }

  /**
   * Migrate all configuration files
   */
  migrateAll(options = {}) {
    const filesToMigrate = [
      '../src/config/index.js',
      '../src/services/email.js',
      '../../docker-compose.yml',
      '../../config/ports.js',
      '../../config/environment-port-manager.js'
    ]

    console.log('🚀 Starting Configuration Migration')
    console.log('=' .repeat(50))

    let migratedCount = 0
    filesToMigrate.forEach(file => {
      const filePath = path.resolve(__dirname, file)
      if (fs.existsSync(filePath)) {
        if (this.migrateFile(filePath, options)) {
          migratedCount++
        }
      }
    })

    console.log(`\n✅ Migration completed: ${migratedCount} files updated`)
    this.generateReport()
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'migrate'
  const options = {
    dryRun: args.includes('--dry-run'),
    createBackup: !args.includes('--no-backup')
  }

  const migrator = new ConfigMigrator()

  switch (command) {
    case 'migrate':
      migrator.migrateAll(options)
      break

    case 'help':
      console.log(`
Heimdall Configuration Migrator

Usage: node migrate-config.js [command] [options]

Commands:
  migrate              Migrate all configuration files (default)
  help                 Show this help message

Options:
  --dry-run           Show what would be changed without making changes
  --no-backup         Skip creating backup files

Examples:
  node migrate-config.js migrate
  node migrate-config.js migrate --dry-run
  node migrate-config.js migrate --no-backup
`)
      break

    default:
      console.log(`Unknown command: ${command}`)
      console.log('Use "node migrate-config.js help" for usage information')
      process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { ConfigMigrator }
