#!/usr/bin/env node

/**
 * RBAC Test Runner
 * 
 * Comprehensive test runner for RBAC system with reporting
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Test configurations
const testConfigs = {
  unit: {
    config: 'jest.rbac.config.js',
    pattern: 'tests/unit/**/*.test.js',
    description: 'Unit Tests for RBAC Services'
  },
  integration: {
    config: 'jest.rbac.config.js',
    pattern: 'tests/integration/**/*.test.js',
    description: 'Integration Tests for Authorization Workflows'
  },
  performance: {
    config: 'jest.rbac.config.js',
    pattern: 'tests/performance/**/*.test.js',
    description: 'Performance Tests for RBAC System'
  },
  all: {
    config: 'jest.rbac.config.js',
    pattern: 'tests/**/*.test.js',
    description: 'All RBAC Tests'
  }
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

/**
 * Print colored output
 */
function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * Print test header
 */
function printHeader(title) {
  const line = '='.repeat(60)
  colorLog('cyan', `\n${line}`)
  colorLog('cyan', `  ${title}`)
  colorLog('cyan', line)
}

/**
 * Print test summary
 */
function printSummary(results) {
  printHeader('TEST SUMMARY')
  
  let totalTests = 0
  let totalPassed = 0
  let totalFailed = 0
  
  for (const [suite, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌'
    const statusColor = result.success ? 'green' : 'red'
    
    colorLog(statusColor, `${status} ${suite.toUpperCase()}: ${result.stats}`)
    
    if (result.tests) {
      totalTests += result.tests.total || 0
      totalPassed += result.tests.passed || 0
      totalFailed += result.tests.failed || 0
    }
  }
  
  console.log()
  colorLog('bright', `Total Tests: ${totalTests}`)
  colorLog('green', `Passed: ${totalPassed}`)
  colorLog('red', `Failed: ${totalFailed}`)
  
  const overallSuccess = totalFailed === 0
  const overallColor = overallSuccess ? 'green' : 'red'
  const overallStatus = overallSuccess ? 'PASSED' : 'FAILED'
  
  colorLog(overallColor, `\nOverall Status: ${overallStatus}`)
  
  return overallSuccess
}

/**
 * Run Jest tests
 */
async function runTests(testType, options = {}) {
  const config = testConfigs[testType]
  if (!config) {
    throw new Error(`Unknown test type: ${testType}`)
  }
  
  colorLog('blue', `\n🧪 Running ${config.description}...`)
  
  const jestArgs = [
    '--config', config.config,
    '--testPathPattern', config.pattern
  ]
  
  if (options.coverage) {
    jestArgs.push('--coverage')
  }
  
  if (options.verbose) {
    jestArgs.push('--verbose')
  }
  
  if (options.watch) {
    jestArgs.push('--watch')
  }
  
  if (options.updateSnapshots) {
    jestArgs.push('--updateSnapshot')
  }
  
  return new Promise((resolve) => {
    const jest = spawn('npx', ['jest', ...jestArgs], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FORCE_COLOR: '1'
      }
    })
    
    jest.on('close', (code) => {
      const success = code === 0
      resolve({
        success,
        code,
        stats: success ? 'All tests passed' : `Tests failed (exit code: ${code})`
      })
    })
    
    jest.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        stats: `Error: ${error.message}`
      })
    })
  })
}

/**
 * Check test environment
 */
async function checkEnvironment() {
  colorLog('yellow', '🔍 Checking test environment...')
  
  const checks = []
  
  // Check if test database is available
  try {
    const { testDatabase } = await import('../tests/helpers/test-database.js')
    await testDatabase.query('SELECT 1')
    checks.push({ name: 'Test Database', status: '✅', message: 'Connected' })
  } catch (error) {
    checks.push({ name: 'Test Database', status: '❌', message: error.message })
  }
  
  // Check if Jest config exists
  try {
    await fs.access(join(projectRoot, 'jest.rbac.config.js'))
    checks.push({ name: 'Jest Config', status: '✅', message: 'Found' })
  } catch (error) {
    checks.push({ name: 'Jest Config', status: '❌', message: 'Missing' })
  }
  
  // Check if test files exist
  try {
    const testDir = join(projectRoot, 'tests')
    await fs.access(testDir)
    checks.push({ name: 'Test Directory', status: '✅', message: 'Found' })
  } catch (error) {
    checks.push({ name: 'Test Directory', status: '❌', message: 'Missing' })
  }
  
  console.log()
  for (const check of checks) {
    colorLog(check.status === '✅' ? 'green' : 'red', 
      `${check.status} ${check.name}: ${check.message}`)
  }
  
  const allPassed = checks.every(check => check.status === '✅')
  if (!allPassed) {
    colorLog('red', '\n❌ Environment check failed. Please fix the issues above.')
    process.exit(1)
  }
  
  colorLog('green', '\n✅ Environment check passed!')
}

/**
 * Generate test report
 */
async function generateReport(results) {
  const reportDir = join(projectRoot, 'test-reports')
  await fs.mkdir(reportDir, { recursive: true })
  
  const reportFile = join(reportDir, `rbac-test-report-${Date.now()}.json`)
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    results,
    summary: {
      totalSuites: Object.keys(results).length,
      passedSuites: Object.values(results).filter(r => r.success).length,
      failedSuites: Object.values(results).filter(r => !r.success).length
    }
  }
  
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
  colorLog('blue', `\n📊 Test report saved to: ${reportFile}`)
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  const testType = args[0] || 'all'
  
  const options = {
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    watch: args.includes('--watch'),
    updateSnapshots: args.includes('--update-snapshots'),
    skipEnvCheck: args.includes('--skip-env-check'),
    report: args.includes('--report')
  }
  
  // Print usage if help requested
  if (args.includes('--help') || args.includes('-h')) {
    printHeader('RBAC Test Runner')
    console.log('Usage: node run-tests.js [test-type] [options]')
    console.log('\nTest Types:')
    for (const [type, config] of Object.entries(testConfigs)) {
      console.log(`  ${type.padEnd(12)} - ${config.description}`)
    }
    console.log('\nOptions:')
    console.log('  --coverage         Generate code coverage report')
    console.log('  --verbose          Verbose test output')
    console.log('  --watch            Watch mode for development')
    console.log('  --update-snapshots Update Jest snapshots')
    console.log('  --skip-env-check   Skip environment validation')
    console.log('  --report           Generate detailed test report')
    console.log('  --help, -h         Show this help message')
    return
  }
  
  printHeader('RBAC SYSTEM TEST RUNNER')
  
  try {
    // Check environment unless skipped
    if (!options.skipEnvCheck) {
      await checkEnvironment()
    }
    
    const results = {}
    
    if (testType === 'all') {
      // Run all test suites
      for (const [type, config] of Object.entries(testConfigs)) {
        if (type === 'all') continue
        results[type] = await runTests(type, options)
      }
    } else {
      // Run specific test suite
      results[testType] = await runTests(testType, options)
    }
    
    // Print summary
    const overallSuccess = printSummary(results)
    
    // Generate report if requested
    if (options.report) {
      await generateReport(results)
    }
    
    // Exit with appropriate code
    process.exit(overallSuccess ? 0 : 1)
    
  } catch (error) {
    colorLog('red', `\n❌ Error: ${error.message}`)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    colorLog('red', `Fatal error: ${error.message}`)
    process.exit(1)
  })
}

export default main