#!/usr/bin/env node

/**
 * Configuration Validation and Migration Tool
 * 
 * This script validates configuration files and helps migrate from hardcoded
 * values to environment variables. It also provides suggestions for optimal
 * configuration values based on the environment.
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
 * Configuration Validation Results
 */
class ValidationResult {
  constructor() {
    this.errors = []
    this.warnings = []
    this.suggestions = []
    this.migrations = []
  }

  addError(message, file, line) {
    this.errors.push({ message, file, line })
  }

  addWarning(message, file, line) {
    this.warnings.push({ message, file, line })
  }

  addSuggestion(message, file, line) {
    this.suggestions.push({ message, file, line })
  }

  addMigration(oldValue, newValue, file, line) {
    this.migrations.push({ oldValue, newValue, file, line })
  }

  hasErrors() {
    return this.errors.length > 0
  }

  hasWarnings() {
    return this.warnings.length > 0
  }

  print() {
    console.log('\n🔍 Configuration Validation Report')
    console.log('=' .repeat(50))

    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:')
      this.errors.forEach(error => {
        console.log(`  • ${error.message}`)
        if (error.file) console.log(`    File: ${error.file}`)
        if (error.line) console.log(`    Line: ${error.line}`)
      })
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:')
      this.warnings.forEach(warning => {
        console.log(`  • ${warning.message}`)
        if (warning.file) console.log(`    File: ${warning.file}`)
        if (warning.line) console.log(`    Line: ${warning.line}`)
      })
    }

    if (this.suggestions.length > 0) {
      console.log('\n💡 SUGGESTIONS:')
      this.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion.message}`)
        if (suggestion.file) console.log(`    File: ${suggestion.file}`)
        if (suggestion.line) console.log(`    Line: ${suggestion.line}`)
      })
    }

    if (this.migrations.length > 0) {
      console.log('\n🔄 MIGRATIONS:')
      this.migrations.forEach(migration => {
        console.log(`  • Replace: ${migration.oldValue}`)
        console.log(`    With: ${migration.newValue}`)
        if (migration.file) console.log(`    File: ${migration.file}`)
        if (migration.line) console.log(`    Line: ${migration.line}`)
      })
    }

    console.log('\n📊 Summary:')
    console.log(`  Errors: ${this.errors.length}`)
    console.log(`  Warnings: ${this.warnings.length}`)
    console.log(`  Suggestions: ${this.suggestions.length}`)
    console.log(`  Migrations: ${this.migrations.length}`)
  }
}

/**
 * Configuration Validator
 */
class ConfigValidator {
  constructor() {
    this.result = new ValidationResult()
    this.hardcodedPatterns = [
      // Port numbers
      { pattern: /:(\d{4,5})/g, type: 'port', message: 'Hardcoded port number detected' },
      // URLs
      { pattern: /https?:\/\/[^\s'"]+/g, type: 'url', message: 'Hardcoded URL detected' },
      // Timeouts and intervals
      { pattern: /(timeout|interval|delay|retry|max|min|limit|threshold|window|ttl|expiry|duration).*[0-9]+/g, type: 'timeout', message: 'Hardcoded timeout/interval detected' },
      // Colors and styling
      { pattern: /#[0-9a-fA-F]{3,6}/g, type: 'color', message: 'Hardcoded color value detected' },
      // Sizes and dimensions
      { pattern: /(width|height|size|padding|margin|font-size).*[0-9]+(px|em|rem|%)/g, type: 'size', message: 'Hardcoded size/dimension detected' }
    ]
  }

  /**
   * Validate a single file
   */
  validateFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n')
      
      lines.forEach((line, index) => {
        this.validateLine(line, filePath, index + 1)
      })
    } catch (error) {
      this.result.addError(`Failed to read file: ${error.message}`, filePath)
    }
  }

  /**
   * Validate a single line
   */
  validateLine(line, filePath, lineNumber) {
    // Skip comments and empty lines
    if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim() === '') {
      return
    }

    this.hardcodedPatterns.forEach(({ pattern, type, message }) => {
      const matches = line.match(pattern)
      if (matches) {
        matches.forEach(match => {
          if (this.isHardcodedValue(match, type)) {
            this.result.addWarning(`${message}: ${match}`, filePath, lineNumber)
            this.suggestMigration(match, type, filePath, lineNumber)
          }
        })
      }
    })
  }

  /**
   * Check if a value is hardcoded (not using environment variables)
   */
  isHardcodedValue(value, type) {
    // Skip if it's already using environment variables
    if (value.includes('process.env.') || value.includes('${') || value.includes('$(')) {
      return false
    }

    // Skip if it's a configuration constant
    if (value.includes('CONSTANTS.') || value.includes('_CONSTANTS.')) {
      return false
    }

    return true
  }

  /**
   * Suggest migration for hardcoded values
   */
  suggestMigration(value, type, filePath, lineNumber) {
    let suggestion = null

    switch (type) {
      case 'port':
        suggestion = this.suggestPortMigration(value)
        break
      case 'url':
        suggestion = this.suggestUrlMigration(value)
        break
      case 'timeout':
        suggestion = this.suggestTimeoutMigration(value)
        break
      case 'color':
        suggestion = this.suggestColorMigration(value)
        break
      case 'size':
        suggestion = this.suggestSizeMigration(value)
        break
    }

    if (suggestion) {
      this.result.addMigration(value, suggestion, filePath, lineNumber)
    }
  }

  /**
   * Suggest port migration
   */
  suggestPortMigration(value) {
    const port = value.replace(/[^\d]/g, '')
    if (port) {
      // Find matching port constant
      const portConstants = ALL_CONSTANTS.PORT
      for (const [key, constantValue] of Object.entries(portConstants)) {
        if (constantValue === parseInt(port)) {
          return `PORT_CONSTANTS.${key}`
        }
      }
      return `parseInteger(process.env.CUSTOM_PORT, ${port})`
    }
    return null
  }

  /**
   * Suggest URL migration
   */
  suggestUrlMigration(value) {
    if (value.includes('localhost')) {
      return 'process.env.API_URL || "http://localhost:3000"'
    }
    if (value.includes('https://')) {
      return 'process.env.EXTERNAL_URL || "' + value + '"'
    }
    return 'process.env.CUSTOM_URL || "' + value + '"'
  }

  /**
   * Suggest timeout migration
   */
  suggestTimeoutMigration(value) {
    if (value.includes('timeout')) {
      return 'parseDuration(process.env.CUSTOM_TIMEOUT || "10s")'
    }
    if (value.includes('interval')) {
      return 'parseDuration(process.env.CUSTOM_INTERVAL || "1m")'
    }
    if (value.includes('retry')) {
      return 'parseInteger(process.env.CUSTOM_RETRY, 3)'
    }
    return 'parseInteger(process.env.CUSTOM_VALUE, 100)'
  }

  /**
   * Suggest color migration
   */
  suggestColorMigration(value) {
    return 'UI_CONSTANTS.PRIMARY_COLOR'
  }

  /**
   * Suggest size migration
   */
  suggestSizeMigration(value) {
    if (value.includes('font-size')) {
      return 'UI_CONSTANTS.EMAIL_LOGO_FONT_SIZE'
    }
    if (value.includes('padding')) {
      return 'UI_CONSTANTS.EMAIL_CONTAINER_PADDING'
    }
    if (value.includes('width')) {
      return 'UI_CONSTANTS.EMAIL_CONTAINER_MAX_WIDTH'
    }
    return 'UI_CONSTANTS.CUSTOM_SIZE'
  }

  /**
   * Validate all configuration files
   */
  validateAll() {
    const configFiles = [
      '../src/config/index.js',
      '../src/services/email.js',
      '../../docker-compose.yml',
      '../../config/ports.js',
      '../../config/environment-port-manager.js'
    ]

    configFiles.forEach(file => {
      const filePath = path.resolve(__dirname, file)
      if (fs.existsSync(filePath)) {
        this.validateFile(filePath)
      }
    })
  }

  /**
   * Generate configuration recommendations
   */
  generateRecommendations() {
    console.log('\n🎯 Configuration Recommendations')
    console.log('=' .repeat(50))

    console.log('\n📋 Environment-Specific Settings:')
    console.log('  Development:')
    console.log('    - Use port range 21000-21999')
    console.log('    - Enable debug logging')
    console.log('    - Use localhost URLs')
    console.log('    - Disable production security features')

    console.log('\n  Staging:')
    console.log('    - Use port range 22000-22999')
    console.log('    - Use staging URLs')
    console.log('    - Enable basic security features')
    console.log('    - Use staging database')

    console.log('\n  Production:')
    console.log('    - Use standard ports (80, 443, 5432, 6379)')
    console.log('    - Use production URLs')
    console.log('    - Enable all security features')
    console.log('    - Use production database with SSL')

    console.log('\n🔧 Performance Optimizations:')
    console.log('  - Set appropriate database pool sizes')
    console.log('  - Configure Redis connection pooling')
    console.log('  - Enable connection keep-alive')
    console.log('  - Set appropriate timeouts')

    console.log('\n🔒 Security Recommendations:')
    console.log('  - Use strong JWT secrets')
    console.log('  - Enable CORS properly')
    console.log('  - Set appropriate rate limits')
    console.log('  - Enable threat detection')
    console.log('  - Use HTTPS in production')
  }

  /**
   * Generate environment file template
   */
  generateEnvTemplate(environment = 'development') {
    console.log(`\n📝 ${environment.toUpperCase()} Environment Template`)
    console.log('=' .repeat(50))

    const template = this.getEnvironmentTemplate(environment)
    console.log(template)
  }

  /**
   * Get environment-specific template
   */
  getEnvironmentTemplate(environment) {
    const baseTemplate = `# ${environment.toUpperCase()} Environment Configuration
# Generated by Heimdall Configuration Validator

# Application Settings
NODE_ENV=${environment}
PORT=${environment === 'production' ? '80' : '3001'}
HOST=0.0.0.0
LOG_LEVEL=${environment === 'production' ? 'info' : 'debug'}

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:${environment === 'production' ? '5432' : '21432'}/heimdall_${environment}
DATABASE_SSL=${environment === 'production' ? 'true' : 'false'}
DATABASE_POOL_MIN=${environment === 'production' ? '10' : '2'}
DATABASE_POOL_MAX=${environment === 'production' ? '100' : '10'}

# Redis Configuration
REDIS_URL=redis://localhost:${environment === 'production' ? '6379' : '21379'}
REDIS_KEY_PREFIX=truxe:${environment}:

# JWT Configuration
JWT_ALGORITHM=RS256
JWT_ISSUER=https://auth.truxe.io
JWT_AUDIENCE=truxe-api
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL=30d

# Email Configuration
EMAIL_PROVIDER=brevo
EMAIL_FROM=noreply@truxe.io
EMAIL_FROM_NAME=Truxe Auth

# Security Configuration
BCRYPT_ROUNDS=12
CORS_ORIGIN=${environment === 'production' ? 'https://yourdomain.com' : 'http://localhost:3000'}
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_GLOBAL_MAX=1000
RATE_LIMIT_GLOBAL_WINDOW=1h
RATE_LIMIT_MAGIC_LINK_PER_IP=5
RATE_LIMIT_MAGIC_LINK_WINDOW=1m

# Feature Flags
ENABLE_SIGNUP=true
ENABLE_MAGIC_LINKS=true
ENABLE_WEBHOOKS=${environment === 'production' ? 'true' : 'false'}
ENABLE_AUDIT_LOGS=true
ENABLE_SWAGGER=${environment === 'production' ? 'false' : 'true'}
ENABLE_REQUEST_LOGGING=true
ENABLE_METRICS=true
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true

# Monitoring
SECURITY_MONITORING_METRICS_RETENTION=30
SECURITY_MONITORING_REAL_TIME_ALERTS=true
ALERT_WEBHOOK_URL=
ALERT_EMAIL=

# Admin
ADMIN_TOKEN=your_admin_token_here
ADMIN_ALLOWED_IPS=
ADMIN_RATE_LIMIT_BYPASS=true
`

    return baseTemplate
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'validate'

  const validator = new ConfigValidator()

  switch (command) {
    case 'validate':
      validator.validateAll()
      validator.result.print()
      break

    case 'recommend':
      validator.generateRecommendations()
      break

    case 'template':
      const environment = args[1] || 'development'
      validator.generateEnvTemplate(environment)
      break

    case 'help':
      console.log(`
Heimdall Configuration Validator

Usage: node validate-config.js [command] [options]

Commands:
  validate              Validate all configuration files (default)
  recommend             Generate configuration recommendations
  template [env]        Generate environment file template
  help                  Show this help message

Examples:
  node validate-config.js validate
  node validate-config.js recommend
  node validate-config.js template production
  node validate-config.js template staging
`)
      break

    default:
      console.log(`Unknown command: ${command}`)
      console.log('Use "node validate-config.js help" for usage information')
      process.exit(1)
  }

  if (validator.result.hasErrors()) {
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { ConfigValidator, ValidationResult }
