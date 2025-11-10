#!/usr/bin/env node

/**
 * Truxe Advanced Database Performance Benchmark
 * 
 * Comprehensive benchmarking suite for production-scale multi-tenant database:
 * - RLS policy performance testing
 * - Multi-tenant query optimization validation
 * - Connection pooling efficiency testing
 * - Security constraint performance impact
 * - Scalability testing with 1000+ tenants
 */

const { OptimizedDatabasePool } = require('../connection-optimized');
const crypto = require('crypto');

// Advanced benchmark configuration
const ADVANCED_BENCHMARK_CONFIG = {
  // Pool configuration for benchmarking
  poolConfig: {
    min: 10,
    max: 100,
    retryAttempts: 1,
    healthCheckInterval: 0,
    metricsInterval: 0,
    enableQueryMetrics: true,
    enablePerformanceAnalysis: true,
    slowQueryThreshold: 100,
  },
  
  // Test scenarios for production scale
  scenarios: {
    // Light load - typical production usage
    lightLoad: {
      concurrent: 50,
      duration: 60000, // 1 minute
      tenantCount: 100,
      usersPerTenant: 10,
      queries: ['select', 'insert', 'update', 'rls'],
    },
    
    // Medium load - peak usage
    mediumLoad: {
      concurrent: 100,
      duration: 120000, // 2 minutes
      tenantCount: 500,
      usersPerTenant: 20,
      queries: ['select', 'insert', 'update', 'complex', 'rls', 'batch'],
    },
    
    // Heavy load - stress testing
    heavyLoad: {
      concurrent: 200,
      duration: 180000, // 3 minutes
      tenantCount: 1000,
      usersPerTenant: 50,
      queries: ['select', 'insert', 'update', 'complex', 'rls', 'batch', 'concurrent_rls'],
    },
    
    // RLS performance test
    rlsPerformance: {
      concurrent: 150,
      duration: 90000, // 1.5 minutes
      tenantCount: 1000,
      usersPerTenant: 30,
      queries: ['rls', 'rls_complex', 'rls_hierarchical'],
    },
    
    // Security constraint test
    securityTest: {
      concurrent: 100,
      duration: 60000, // 1 minute
      tenantCount: 500,
      usersPerTenant: 25,
      queries: ['secure_select', 'secure_insert', 'secure_update', 'injection_test'],
    },
  },
  
  // Performance targets for production scale
  targets: {
    avgResponseTime: 50, // ms
    p95ResponseTime: 200, // ms
    p99ResponseTime: 500, // ms
    errorRate: 0.005, // 0.5%
    throughput: 2000, // queries per second
    rlsOverhead: 0.1, // 10% max overhead for RLS
    connectionUtilization: 0.8, // 80% max utilization
  },
};

class AdvancedDatabaseBenchmark {
  constructor() {
    this.pool = null;
    this.results = {};
    this.testData = {
      tenants: [],
      users: [],
      sessions: [],
      auditLogs: [],
    };
    this.metrics = {
      totalQueries: 0,
      totalErrors: 0,
      totalRLSQueries: 0,
      totalBatchQueries: 0,
      averageQueryTime: 0,
      averageRLSTime: 0,
      connectionPoolMetrics: {},
    };
  }

  async initialize() {
    console.log('🚀 Initializing Advanced Database Benchmark...\n');
    
    this.pool = new OptimizedDatabasePool(ADVANCED_BENCHMARK_CONFIG.poolConfig);
    
    await new Promise(resolve => {
      this.pool.on('initialized', resolve);
    });
    
    // Setup comprehensive test data
    await this.setupAdvancedTestData();
    console.log('✅ Advanced benchmark initialization complete\n');
  }

  async setupAdvancedTestData() {
    console.log('📊 Setting up advanced test data...');
    
    const { tenantCount, usersPerTenant } = ADVANCED_BENCHMARK_CONFIG.scenarios.heavyLoad;
    
    // Create tenants (organizations)
    for (let i = 0; i < tenantCount; i++) {
      const tenant = await this.createTestTenant(`bench-tenant-${i}`);
      this.testData.tenants.push(tenant);
      
      // Create users for this tenant
      for (let j = 0; j < usersPerTenant; j++) {
        const user = await this.createTestUser(`user-${i}-${j}@tenant${i}.com`, tenant.id);
        this.testData.users.push(user);
        
        // Create memberships with different roles
        const role = j === 0 ? 'owner' : j < 3 ? 'admin' : 'member';
        await this.createMembership(tenant.id, user.id, role);
        
        // Create sessions
        for (let k = 0; k < 3; k++) {
          const session = await this.createTestSession(user.id, tenant.id);
          this.testData.sessions.push(session);
        }
      }
      
      // Create audit logs
      for (let k = 0; k < 100; k++) {
        const auditLog = await this.createTestAuditLog(tenant.id, this.testData.users.find(u => u.tenant_id === tenant.id).id);
        this.testData.auditLogs.push(auditLog);
      }
    }
    
    console.log(`✅ Created ${this.testData.tenants.length} tenants, ${this.testData.users.length} users, ${this.testData.sessions.length} sessions, ${this.testData.auditLogs.length} audit logs`);
  }

  async runAllBenchmarks() {
    console.log('🏁 Starting Advanced Database Performance Benchmarks\n');
    
    for (const [scenarioName, config] of Object.entries(ADVANCED_BENCHMARK_CONFIG.scenarios)) {
      console.log(`\n=== ${scenarioName.toUpperCase()} BENCHMARK ===`);
      console.log(`Concurrent connections: ${config.concurrent}`);
      console.log(`Duration: ${config.duration / 1000}s`);
      console.log(`Tenant count: ${config.tenantCount}`);
      console.log(`Users per tenant: ${config.usersPerTenant}`);
      console.log(`Query types: ${config.queries.join(', ')}\n`);
      
      const results = await this.runAdvancedScenario(scenarioName, config);
      this.results[scenarioName] = results;
      
      this.printAdvancedResults(scenarioName, results);
    }
    
    console.log('\n=== ADVANCED BENCHMARK SUMMARY ===');
    this.printAdvancedSummary();
    
    await this.validateAdvancedTargets();
    await this.generatePerformanceReport();
  }

  async runAdvancedScenario(scenarioName, config) {
    const startTime = Date.now();
    const endTime = startTime + config.duration;
    const workers = [];
    const results = {
      totalQueries: 0,
      totalErrors: 0,
      totalRLSQueries: 0,
      totalBatchQueries: 0,
      responseTimes: [],
      rlsResponseTimes: [],
      queryTypes: {},
      connectionMetrics: [],
      startTime,
      endTime: null,
      duration: 0,
    };

    // Initialize query type counters
    config.queries.forEach(type => {
      results.queryTypes[type] = { 
        count: 0, 
        errors: 0, 
        totalTime: 0, 
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
      };
    });

    // Start worker promises
    for (let i = 0; i < config.concurrent; i++) {
      workers.push(this.runAdvancedWorker(i, config, endTime, results));
    }

    // Monitor connection pool metrics
    const metricsInterval = setInterval(() => {
      const poolMetrics = this.pool.getDetailedMetrics();
      results.connectionMetrics.push({
        timestamp: Date.now(),
        ...poolMetrics.pool,
        utilizationRate: poolMetrics.utilizationRate,
      });
    }, 5000);

    // Wait for all workers to complete
    await Promise.all(workers);
    clearInterval(metricsInterval);
    
    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    
    return results;
  }

  async runAdvancedWorker(workerId, config, endTime, results) {
    while (Date.now() < endTime) {
      const queryType = config.queries[Math.floor(Math.random() * config.queries.length)];
      const startTime = Date.now();
      
      try {
        await this.executeAdvancedQuery(queryType, config);
        
        const responseTime = Date.now() - startTime;
        results.responseTimes.push(responseTime);
        results.totalQueries++;
        results.queryTypes[queryType].count++;
        results.queryTypes[queryType].totalTime += responseTime;
        
        // Track RLS queries separately
        if (queryType.includes('rls')) {
          results.totalRLSQueries++;
          results.rlsResponseTimes.push(responseTime);
        }
        
        // Track batch queries
        if (queryType === 'batch') {
          results.totalBatchQueries++;
        }
        
        // Update min/max times
        results.queryTypes[queryType].minTime = Math.min(results.queryTypes[queryType].minTime, responseTime);
        results.queryTypes[queryType].maxTime = Math.max(results.queryTypes[queryType].maxTime, responseTime);
        
      } catch (error) {
        results.totalErrors++;
        results.queryTypes[queryType].errors++;
        
        if (process.env.NODE_ENV === 'development') {
          console.error(`Worker ${workerId} error:`, error.message);
        }
      }
      
      // Small delay to prevent overwhelming
      await this.sleep(Math.random() * 5);
    }
  }

  async executeAdvancedQuery(queryType, config) {
    const randomTenant = this.getRandomTenant();
    const randomUser = this.getRandomUserForTenant(randomTenant.id);
    
    switch (queryType) {
      case 'select':
        return await this.benchmarkSelect(randomUser, randomTenant);
      
      case 'insert':
        return await this.benchmarkInsert(randomUser, randomTenant);
      
      case 'update':
        return await this.benchmarkUpdate(randomUser, randomTenant);
      
      case 'complex':
        return await this.benchmarkComplexQuery(randomUser, randomTenant);
      
      case 'rls':
        return await this.benchmarkRLSQuery(randomUser, randomTenant);
      
      case 'rls_complex':
        return await this.benchmarkComplexRLSQuery(randomUser, randomTenant);
      
      case 'rls_hierarchical':
        return await this.benchmarkHierarchicalRLSQuery(randomUser, randomTenant);
      
      case 'batch':
        return await this.benchmarkBatchQuery(randomUser, randomTenant);
      
      case 'concurrent_rls':
        return await this.benchmarkConcurrentRLS(randomUser, randomTenant);
      
      case 'secure_select':
        return await this.benchmarkSecureSelect(randomUser, randomTenant);
      
      case 'secure_insert':
        return await this.benchmarkSecureInsert(randomUser, randomTenant);
      
      case 'secure_update':
        return await this.benchmarkSecureUpdate(randomUser, randomTenant);
      
      case 'injection_test':
        return await this.benchmarkInjectionTest(randomUser, randomTenant);
      
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }
  }

  async benchmarkSelect(user, tenant) {
    return await this.pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [user.id]
    );
  }

  async benchmarkInsert(user, tenant) {
    return await this.pool.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, details) 
      VALUES ($1, $2, $3, $4)
    `, [tenant.id, user.id, 'benchmark.test', JSON.stringify({ benchmark: true, timestamp: Date.now() })]);
  }

  async benchmarkUpdate(user, tenant) {
    const metadata = { lastBenchmark: Date.now(), random: Math.random() };
    return await this.pool.query(
      'UPDATE users SET metadata = $1 WHERE id = $2',
      [JSON.stringify(metadata), user.id]
    );
  }

  async benchmarkComplexQuery(user, tenant) {
    return await this.pool.query(`
      SELECT 
        u.id, u.email, u.status,
        o.id as org_id, o.name as org_name,
        m.role, m.joined_at,
        COUNT(s.jti) as session_count,
        COUNT(al.id) as audit_count
      FROM users u
      JOIN memberships m ON u.id = m.user_id
      JOIN organizations o ON m.org_id = o.id
      LEFT JOIN sessions s ON u.id = s.user_id AND s.revoked_at IS NULL
      LEFT JOIN audit_logs al ON o.id = al.org_id
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.status, o.id, o.name, m.role, m.joined_at
    `, [user.id]);
  }

  async benchmarkRLSQuery(user, tenant) {
    await this.pool.setRLSContext(user.id, tenant.id);
    
    try {
      return await this.pool.query(`
        SELECT COUNT(*) as member_count 
        FROM memberships 
        WHERE org_id = $1
      `, [tenant.id]);
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  async benchmarkComplexRLSQuery(user, tenant) {
    await this.pool.setRLSContext(user.id, tenant.id);
    
    try {
      return await this.pool.query(`
        SELECT 
          o.id, o.name, o.slug,
          COUNT(m.user_id) as member_count,
          COUNT(s.jti) as active_sessions,
          COUNT(al.id) as recent_audit_logs
        FROM organizations o
        LEFT JOIN memberships m ON o.id = m.org_id
        LEFT JOIN sessions s ON o.id = s.org_id AND s.revoked_at IS NULL
        LEFT JOIN audit_logs al ON o.id = al.org_id AND al.created_at > now() - interval '1 day'
        WHERE o.id = $1
        GROUP BY o.id, o.name, o.slug
      `, [tenant.id]);
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  async benchmarkHierarchicalRLSQuery(user, tenant) {
    await this.pool.setRLSContext(user.id, tenant.id);
    
    try {
      return await this.pool.query(`
        SELECT 
          parent.id as parent_id,
          parent.name as parent_name,
          child.id as child_id,
          child.name as child_name
        FROM organizations parent
        LEFT JOIN organizations child ON child.parent_org_id = parent.id
        WHERE parent.id = $1 OR child.id = $1
      `, [tenant.id]);
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  async benchmarkBatchQuery(user, tenant) {
    const queries = [
      { text: 'SELECT COUNT(*) FROM organizations WHERE id = $1', params: [tenant.id] },
      { text: 'SELECT COUNT(*) FROM memberships WHERE org_id = $1', params: [tenant.id] },
      { text: 'SELECT COUNT(*) FROM sessions WHERE org_id = $1', params: [tenant.id] },
    ];
    
    return await this.pool.batchQuery(queries, { parallel: true });
  }

  async benchmarkConcurrentRLS(user, tenant) {
    // Simulate concurrent RLS queries
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(this.benchmarkRLSQuery(user, tenant));
    }
    
    return await Promise.all(promises);
  }

  async benchmarkSecureSelect(user, tenant) {
    await this.pool.setRLSContext(user.id, tenant.id);
    
    try {
      // Test with potential injection attempt
      const maliciousInput = "'; DROP TABLE users; --";
      return await this.pool.query(
        'SELECT * FROM organizations WHERE slug = $1',
        [maliciousInput]
      );
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  async benchmarkSecureInsert(user, tenant) {
    await this.pool.setRLSContext(user.id, tenant.id);
    
    try {
      const maliciousData = {
        "normal": "value",
        "'; DROP TABLE sessions; --": "injection_attempt"
      };
      
      return await this.pool.query(`
        INSERT INTO audit_logs (org_id, actor_user_id, action, details) 
        VALUES ($1, $2, $3, $4)
      `, [tenant.id, user.id, 'benchmark.secure_insert', JSON.stringify(maliciousData)]);
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  async benchmarkSecureUpdate(user, tenant) {
    await this.pool.setRLSContext(user.id, tenant.id);
    
    try {
      const maliciousRole = "admin'; UPDATE users SET status = 'blocked'; --";
      
      return await this.pool.query(
        'SELECT * FROM memberships WHERE role = $1',
        [maliciousRole]
      );
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  async benchmarkInjectionTest(user, tenant) {
    const injectionAttempts = [
      "'; UNION SELECT id, email FROM users; --",
      "' OR '1'='1' AND (SELECT COUNT(*) FROM users) > 0; --",
      "'; WAITFOR DELAY '00:00:05'; --",
      "'; DROP TABLE users; INSERT INTO users (email) VALUES ('hacked'); --",
    ];
    
    const results = [];
    
    for (const injection of injectionAttempts) {
      try {
        const result = await this.pool.query(
          'SELECT * FROM organizations WHERE slug = $1',
          [injection]
        );
        results.push({ injection, success: true, result });
      } catch (error) {
        results.push({ injection, success: false, error: error.message });
      }
    }
    
    return results;
  }

  printAdvancedResults(scenarioName, results) {
    const durationSeconds = results.duration / 1000;
    const qps = results.totalQueries / durationSeconds;
    const errorRate = results.totalErrors / results.totalQueries;
    const rlsOverhead = results.totalRLSQueries > 0 ? 
      (results.rlsResponseTimes.reduce((a, b) => a + b, 0) / results.rlsResponseTimes.length) /
      (results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length) - 1 : 0;
    
    // Calculate percentiles
    const sortedTimes = results.responseTimes.sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sortedTimes, 50);
    const p95 = this.calculatePercentile(sortedTimes, 95);
    const p99 = this.calculatePercentile(sortedTimes, 99);
    const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
    
    console.log(`📊 Results for ${scenarioName}:`);
    console.log(`   Duration: ${durationSeconds.toFixed(1)}s`);
    console.log(`   Total Queries: ${results.totalQueries}`);
    console.log(`   Queries/sec: ${qps.toFixed(1)}`);
    console.log(`   Error Rate: ${(errorRate * 100).toFixed(3)}%`);
    console.log(`   RLS Queries: ${results.totalRLSQueries} (${((results.totalRLSQueries / results.totalQueries) * 100).toFixed(1)}%)`);
    console.log(`   Batch Queries: ${results.totalBatchQueries}`);
    console.log(`   RLS Overhead: ${(rlsOverhead * 100).toFixed(1)}%`);
    console.log(`   Response Times:`);
    console.log(`     Average: ${avg.toFixed(1)}ms`);
    console.log(`     P50: ${p50}ms`);
    console.log(`     P95: ${p95}ms`);
    console.log(`     P99: ${p99}ms`);
    
    console.log(`   Query Breakdown:`);
    Object.entries(results.queryTypes).forEach(([type, stats]) => {
      if (stats.count > 0) {
        const avgTime = stats.totalTime / stats.count;
        const errorRate = stats.errors / stats.count;
        console.log(`     ${type}: ${stats.count} queries, ${avgTime.toFixed(1)}ms avg, ${stats.minTime}ms min, ${stats.maxTime}ms max, ${(errorRate * 100).toFixed(2)}% errors`);
      }
    });
    
    // Connection pool metrics
    if (results.connectionMetrics.length > 0) {
      const avgUtilization = results.connectionMetrics.reduce((sum, m) => sum + m.utilizationRate, 0) / results.connectionMetrics.length;
      console.log(`   Connection Pool:`);
      console.log(`     Avg Utilization: ${(avgUtilization * 100).toFixed(1)}%`);
      console.log(`     Max Connections: ${Math.max(...results.connectionMetrics.map(m => m.totalCount))}`);
    }
  }

  printAdvancedSummary() {
    const scenarios = Object.keys(this.results);
    
    console.log('\n📈 Advanced Performance Summary:');
    console.log('Scenario'.padEnd(20) + 'QPS'.padEnd(10) + 'Avg(ms)'.padEnd(10) + 'P95(ms)'.padEnd(10) + 'RLS%'.padEnd(8) + 'Errors%'.padEnd(10) + 'Util%'.padEnd(8));
    console.log('-'.repeat(78));
    
    scenarios.forEach(scenario => {
      const results = this.results[scenario];
      const durationSeconds = results.duration / 1000;
      const qps = results.totalQueries / durationSeconds;
      const errorRate = results.totalErrors / results.totalQueries;
      const rlsPercentage = (results.totalRLSQueries / results.totalQueries) * 100;
      
      const sortedTimes = results.responseTimes.sort((a, b) => a - b);
      const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
      const p95 = this.calculatePercentile(sortedTimes, 95);
      
      const avgUtilization = results.connectionMetrics.length > 0 ? 
        results.connectionMetrics.reduce((sum, m) => sum + m.utilizationRate, 0) / results.connectionMetrics.length : 0;
      
      console.log(
        scenario.padEnd(20) + 
        qps.toFixed(1).padEnd(10) + 
        avg.toFixed(1).padEnd(10) + 
        p95.toString().padEnd(10) + 
        `${rlsPercentage.toFixed(1)}%`.padEnd(8) + 
        `${(errorRate * 100).toFixed(2)}%`.padEnd(10) + 
        `${(avgUtilization * 100).toFixed(1)}%`.padEnd(8)
      );
    });
  }

  async validateAdvancedTargets() {
    console.log('\n🎯 Validating Advanced Performance Targets:');
    
    const heavyLoadResults = this.results.heavyLoad;
    if (!heavyLoadResults) {
      console.log('❌ Heavy load test not found');
      return;
    }
    
    const durationSeconds = heavyLoadResults.duration / 1000;
    const qps = heavyLoadResults.totalQueries / durationSeconds;
    const errorRate = heavyLoadResults.totalErrors / heavyLoadResults.totalQueries;
    
    const sortedTimes = heavyLoadResults.responseTimes.sort((a, b) => a - b);
    const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
    const p95 = this.calculatePercentile(sortedTimes, 95);
    const p99 = this.calculatePercentile(sortedTimes, 99);
    
    // Calculate RLS overhead
    const rlsOverhead = heavyLoadResults.totalRLSQueries > 0 ? 
      (heavyLoadResults.rlsResponseTimes.reduce((a, b) => a + b, 0) / heavyLoadResults.rlsResponseTimes.length) /
      (heavyLoadResults.responseTimes.reduce((a, b) => a + b, 0) / heavyLoadResults.responseTimes.length) - 1 : 0;
    
    // Calculate connection utilization
    const avgUtilization = heavyLoadResults.connectionMetrics.length > 0 ? 
      heavyLoadResults.connectionMetrics.reduce((sum, m) => sum + m.utilizationRate, 0) / heavyLoadResults.connectionMetrics.length : 0;
    
    const checks = [
      { name: 'Average Response Time', value: avg, target: ADVANCED_BENCHMARK_CONFIG.targets.avgResponseTime, unit: 'ms', operator: '<=' },
      { name: 'P95 Response Time', value: p95, target: ADVANCED_BENCHMARK_CONFIG.targets.p95ResponseTime, unit: 'ms', operator: '<=' },
      { name: 'P99 Response Time', value: p99, target: ADVANCED_BENCHMARK_CONFIG.targets.p99ResponseTime, unit: 'ms', operator: '<=' },
      { name: 'Error Rate', value: errorRate * 100, target: ADVANCED_BENCHMARK_CONFIG.targets.errorRate * 100, unit: '%', operator: '<=' },
      { name: 'Throughput', value: qps, target: ADVANCED_BENCHMARK_CONFIG.targets.throughput, unit: 'qps', operator: '>=' },
      { name: 'RLS Overhead', value: rlsOverhead * 100, target: ADVANCED_BENCHMARK_CONFIG.targets.rlsOverhead * 100, unit: '%', operator: '<=' },
      { name: 'Connection Utilization', value: avgUtilization * 100, target: ADVANCED_BENCHMARK_CONFIG.targets.connectionUtilization * 100, unit: '%', operator: '<=' },
    ];
    
    let allPassed = true;
    
    checks.forEach(check => {
      const passed = check.operator === '<=' ? check.value <= check.target : check.value >= check.target;
      const status = passed ? '✅' : '❌';
      allPassed = allPassed && passed;
      
      console.log(`${status} ${check.name}: ${check.value.toFixed(1)}${check.unit} (target: ${check.operator} ${check.target}${check.unit})`);
    });
    
    if (allPassed) {
      console.log('\n🎉 All advanced performance targets met!');
    } else {
      console.log('\n⚠️  Some performance targets not met. Consider optimization.');
    }
  }

  async generatePerformanceReport() {
    console.log('\n📋 Generating Performance Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      scenarios: {},
      summary: {
        totalScenarios: Object.keys(this.results).length,
        totalQueries: Object.values(this.results).reduce((sum, r) => sum + r.totalQueries, 0),
        totalErrors: Object.values(this.results).reduce((sum, r) => sum + r.totalErrors, 0),
        totalRLSQueries: Object.values(this.results).reduce((sum, r) => sum + r.totalRLSQueries, 0),
      },
      recommendations: []
    };
    
    // Analyze each scenario
    Object.entries(this.results).forEach(([scenarioName, results]) => {
      const durationSeconds = results.duration / 1000;
      const qps = results.totalQueries / durationSeconds;
      const errorRate = results.totalErrors / results.totalQueries;
      const rlsPercentage = (results.totalRLSQueries / results.totalQueries) * 100;
      
      const sortedTimes = results.responseTimes.sort((a, b) => a - b);
      const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
      const p95 = this.calculatePercentile(sortedTimes, 95);
      const p99 = this.calculatePercentile(sortedTimes, 99);
      
      report.scenarios[scenarioName] = {
        duration: results.duration,
        totalQueries: results.totalQueries,
        qps,
        errorRate,
        rlsPercentage,
        responseTimes: {
          avg,
          p50: this.calculatePercentile(sortedTimes, 50),
          p95,
          p99,
        },
        queryTypes: results.queryTypes,
      };
      
      // Generate recommendations
      if (errorRate > 0.01) {
        report.recommendations.push(`${scenarioName}: High error rate (${(errorRate * 100).toFixed(2)}%) - investigate query failures`);
      }
      if (p95 > 200) {
        report.recommendations.push(`${scenarioName}: High P95 response time (${p95}ms) - consider query optimization`);
      }
      if (rlsPercentage > 50 && avg > 100) {
        report.recommendations.push(`${scenarioName}: High RLS usage with slow queries - optimize RLS policies`);
      }
    });
    
    console.log('📊 Performance Report Generated:');
    console.log(`   Total Scenarios: ${report.summary.totalScenarios}`);
    console.log(`   Total Queries: ${report.summary.totalQueries.toLocaleString()}`);
    console.log(`   Total Errors: ${report.summary.totalErrors.toLocaleString()}`);
    console.log(`   Total RLS Queries: ${report.summary.totalRLSQueries.toLocaleString()}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }

  calculatePercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index] || 0;
  }

  getRandomTenant() {
    return this.testData.tenants[Math.floor(Math.random() * this.testData.tenants.length)];
  }

  getRandomUserForTenant(tenantId) {
    const tenantUsers = this.testData.users.filter(u => u.tenant_id === tenantId);
    return tenantUsers[Math.floor(Math.random() * tenantUsers.length)];
  }

  async createTestTenant(slug) {
    const result = await this.pool.query(
      'INSERT INTO organizations (slug, name) VALUES ($1, $2) RETURNING *',
      [slug, `Benchmark Tenant ${slug}`]
    );
    return result.rows[0];
  }

  async createTestUser(email, tenantId) {
    const result = await this.pool.query(
      'INSERT INTO users (email, status, email_verified, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
      [email, 'active', true, JSON.stringify({ test: true, tenant_id: tenantId })]
    );
    return { ...result.rows[0], tenant_id: tenantId };
  }

  async createMembership(orgId, userId, role) {
    await this.pool.query(`
      INSERT INTO memberships (org_id, user_id, role, joined_at) 
      VALUES ($1, $2, $3, now())
    `, [orgId, userId, role]);
  }

  async createTestSession(userId, orgId) {
    const result = await this.pool.query(`
      INSERT INTO sessions (user_id, org_id, expires_at, device_info) 
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [
      userId, 
      orgId, 
      new Date(Date.now() + 24 * 60 * 60 * 1000),
      JSON.stringify({ test: true, benchmark: true })
    ]);
    
    return result.rows[0];
  }

  async createTestAuditLog(orgId, actorUserId) {
    await this.pool.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, details) 
      VALUES ($1, $2, $3, $4)
    `, [orgId, actorUserId, 'benchmark.test', JSON.stringify({ test: true, benchmark: true })]);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up advanced benchmark data...');
    
    try {
      // Clean up in dependency order
      await this.pool.query("DELETE FROM audit_logs WHERE details @> '{\"benchmark\": true}'");
      await this.pool.query("DELETE FROM sessions WHERE device_info @> '{\"benchmark\": true}'");
      await this.pool.query("DELETE FROM memberships WHERE org_id = ANY($1)", [this.testData.tenants.map(t => t.id)]);
      await this.pool.query("DELETE FROM organizations WHERE id = ANY($1)", [this.testData.tenants.map(t => t.id)]);
      await this.pool.query("DELETE FROM users WHERE id = ANY($1)", [this.testData.users.map(u => u.id)]);
      
      console.log('✅ Advanced benchmark cleanup complete');
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
    
    await this.pool.close();
  }
}

// CLI interface
async function main() {
  const benchmark = new AdvancedDatabaseBenchmark();
  
  try {
    await benchmark.initialize();
    await benchmark.runAllBenchmarks();
  } catch (error) {
    console.error('❌ Advanced benchmark failed:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await benchmark.cleanup();
  }
}

// Handle signals
process.on('SIGINT', async () => {
  console.log('\n⏹️  Advanced benchmark interrupted');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { AdvancedDatabaseBenchmark };
