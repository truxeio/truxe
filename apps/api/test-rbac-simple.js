#!/usr/bin/env node

/**
 * Simple RBAC test script to validate the system
 */

import { testDatabase, setupTestData, cleanupTestData } from './tests/helpers/test-database.js'
import PermissionService from './src/services/rbac/permission-service.js'

async function testRBAC() {
  let testData = null
  
  try {
    console.log('🚀 Setting up test data...')
    testData = await setupTestData()
    console.log('✅ Test data created')
    
    console.log('🔧 Initializing RBAC services...')
    const mockAuditLogger = {
      logEvent: async (event) => {
        console.log('📝 Audit event:', event.action)
      }
    }
    const permissionService = new PermissionService(testDatabase, mockAuditLogger)
    console.log('✅ Services initialized')
    
    console.log('🔐 Testing permission granting...')
    const { users, tenants } = testData
    
    // Grant a simple permission
    const permission = await permissionService.grantPermission(
      users.alice.id,
      tenants.child.id,
      'documents',
      ['read', 'write']
    )
    
    console.log('✅ Permission granted:', {
      userId: permission.userId,
      tenantId: permission.tenantId,
      resourceType: permission.resourceType,
      actions: permission.actions
    })
    
    console.log('🔍 Testing permission checking...')
    const hasRead = await permissionService.hasPermission(
      users.alice.id,
      tenants.child.id,
      'documents',
      'read'
    )
    
    console.log('✅ Permission check result:', hasRead)
    
    console.log('🧹 Cleaning up...')
    await cleanupTestData(testData.testId)
    console.log('✅ Cleanup complete')
    
    console.log('🎉 RBAC test completed successfully!')
    
  } catch (error) {
    console.error('❌ RBAC test failed:', error.message)
    console.error('Stack:', error.stack)
    
    if (testData) {
      try {
        await cleanupTestData(testData.testId)
        console.log('✅ Emergency cleanup completed')
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError.message)
      }
    }
    
    process.exit(1)
  } finally {
    await testDatabase.end()
  }
}

testRBAC()