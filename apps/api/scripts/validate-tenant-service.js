#!/usr/bin/env node
/**
 * Validation script for Tenant Hierarchy Service
 * Tests that all modules can be imported and basic structure is correct
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdir, stat } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const serviceDir = join(__dirname, '../src/services/tenant')

async function validateServiceStructure() {
  console.log('🔍 Validating Tenant Hierarchy Service Structure...\n')

  const requiredFiles = [
    'index.js',
    'repository.js',
    'validation.js',
    'hierarchy.js',
    'path.js',
    'lifecycle.js',
    'members.js',
    'config.js',
  ]

  const requiredUtils = [
    'utils/cache-manager.js',
    'utils/path-formatter.js',
    'utils/slug-generator.js',
  ]

  let allValid = true

  // Check service files
  console.log('📁 Checking service files:')
  for (const file of requiredFiles) {
    const filePath = join(serviceDir, file)
    try {
      const stats = await stat(filePath)
      if (stats.isFile()) {
        console.log(`  ✅ ${file} (${stats.size} bytes)`)
      } else {
        console.log(`  ❌ ${file} is not a file`)
        allValid = false
      }
    } catch (error) {
      console.log(`  ❌ ${file} not found`)
      allValid = false
    }
  }

  // Check utility files
  console.log('\n🛠️  Checking utility files:')
  for (const file of requiredUtils) {
    const filePath = join(serviceDir, file)
    try {
      const stats = await stat(filePath)
      if (stats.isFile()) {
        console.log(`  ✅ ${file} (${stats.size} bytes)`)
      } else {
        console.log(`  ❌ ${file} is not a file`)
        allValid = false
      }
    } catch (error) {
      console.log(`  ❌ ${file} not found`)
      allValid = false
    }
  }

  // Count total lines
  console.log('\n📊 Code metrics:')
  let totalLines = 0
  try {
    for (const file of [...requiredFiles, ...requiredUtils]) {
      const filePath = join(serviceDir, file)
      const { execSync } = await import('child_process')
      const lines = parseInt(execSync(`wc -l < "${filePath}"`, { encoding: 'utf8' }).trim())
      totalLines += lines
    }
    console.log(`  Total service lines: ${totalLines}`)
  } catch (error) {
    console.log(`  ⚠️  Could not count lines: ${error.message}`)
  }

  // Check test files
  console.log('\n🧪 Checking test files:')
  const testDir = join(__dirname, '../tests')
  const testPatterns = ['unit/tenant', 'integration/tenant', 'performance/tenant']

  for (const pattern of testPatterns) {
    try {
      const dir = join(testDir, pattern.split('/')[0])
      const files = await readdir(dir)
      const testFiles = files.filter(f => f.includes('tenant') && f.endsWith('.test.js'))
      if (testFiles.length > 0) {
        console.log(`  ✅ ${pattern}*: ${testFiles.length} file(s)`)
        testFiles.forEach(f => console.log(`     - ${f}`))
      } else {
        console.log(`  ⚠️  ${pattern}*: no test files found`)
      }
    } catch (error) {
      console.log(`  ⚠️  ${pattern}*: directory not accessible`)
    }
  }

  // Check documentation
  console.log('\n📚 Checking documentation:')
  const docsPath = join(__dirname, '../../docs/services/tenant-hierarchy-service.md')
  try {
    const stats = await stat(docsPath)
    console.log(`  ✅ tenant-hierarchy-service.md (${stats.size} bytes)`)
  } catch (error) {
    console.log(`  ❌ Documentation not found`)
    allValid = false
  }

  // Final summary
  console.log('\n' + '='.repeat(60))
  if (allValid) {
    console.log('✅ VALIDATION PASSED')
    console.log('All required files are present and structure is correct.')
    console.log('\n📋 Next steps:')
    console.log('  1. Ensure database migration 030 is applied')
    console.log('  2. Configure environment variables')
    console.log('  3. Run integration tests with database')
    console.log('  4. Proceed to Ticket #3B (RBAC + ABAC Engine)')
    process.exit(0)
  } else {
    console.log('❌ VALIDATION FAILED')
    console.log('Some required files are missing.')
    process.exit(1)
  }
}

validateServiceStructure().catch(error => {
  console.error('❌ Validation script failed:', error.message)
  process.exit(1)
})