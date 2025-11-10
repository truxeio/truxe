#!/usr/bin/env node

/**
 * Performance Testing Script for Admin Dashboard
 * 
 * This script runs comprehensive performance tests on the admin dashboard
 * and generates detailed reports with recommendations.
 */

const { PerformanceTester, DEFAULT_THRESHOLDS } = require('../dist/lib/performance-testing');
const fs = require('fs');
const path = require('path');

// Custom thresholds for admin dashboard
const ADMIN_THRESHOLDS = {
  maxLoadTime: 2000, // 2 seconds
  maxBundleSize: 500 * 1024, // 500KB
  maxMemoryUsage: 50 * 1024 * 1024, // 50MB
  minCacheHitRate: 0.8, // 80%
  maxRenderTime: 100, // 100ms
};

async function runPerformanceTests() {
  console.log('🚀 Starting Admin Dashboard Performance Tests...\n');
  
  const tester = new PerformanceTester(ADMIN_THRESHOLDS);
  
  try {
    // Run comprehensive performance tests
    const results = await tester.runComprehensiveTest();
    
    // Generate detailed report
    const report = tester.generateReport();
    
    // Display results
    console.log('📊 Performance Test Results:');
    console.log('============================\n');
    
    results.forEach(result => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${status} ${result.testName}`);
      console.log(`   Score: ${result.score.toFixed(1)}/100`);
      console.log(`   Load Time: ${result.metrics.loadTime.toFixed(2)}ms`);
      console.log(`   Bundle Size: ${(result.metrics.bundleSize / 1024).toFixed(2)}KB`);
      console.log(`   Memory Usage: ${(result.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Cache Hit Rate: ${(result.metrics.cacheHitRate * 100).toFixed(1)}%`);
      
      if (result.recommendations.length > 0) {
        console.log(`   Recommendations:`);
        result.recommendations.forEach(rec => {
          console.log(`     - ${rec}`);
        });
      }
      console.log('');
    });
    
    // Overall summary
    const overallScore = tester.getOverallScore();
    const passedTests = tester.getPassedTests();
    const totalTests = tester.getTotalTests();
    
    console.log('📈 Overall Performance Summary:');
    console.log('===============================');
    console.log(`Overall Score: ${overallScore.toFixed(1)}/100`);
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`Performance Status: ${overallScore >= 80 ? '🟢 EXCELLENT' : overallScore >= 60 ? '🟡 GOOD' : '🔴 NEEDS IMPROVEMENT'}`);
    
    // Save detailed report to file
    const reportPath = path.join(__dirname, '..', 'reports', 'performance-report.md');
    const reportsDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    
    // Exit with appropriate code
    process.exit(overallScore >= 80 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Performance testing failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runPerformanceTests();
}

module.exports = { runPerformanceTests };

