#!/usr/bin/env node

/**
 * Truxe Database Performance Benchmark
 * 
 * Comprehensive benchmarking suite to validate database performance
 * under various load conditions and ensure it meets requirements.
 */

const { DatabasePool } = require('../connection');
const crypto = require('crypto');

// Benchmark configuration
const BENCHMARK_CONFIG = {
  // Connection pool settings for benchmarking
  poolConfig: {
    min: 5,
    max: 50,
    retryAttempts: 1,
    healthCheckInterval: 0,
    metricsInterval: 0,
  },
  
  // Test scenarios
  scenarios: {
    lightLoad: {
      concurrent: 10,
      duration: 30000, // 30 seconds
      queries: ['select', 'insert', 'update'],
    },
    mediumLoad: {
      concurrent: 50,
      duration: 60000, // 1 minute
      queries: ['select', 'insert', 'update', 'complex'],
    },
    heavyLoad: {
      concurrent: 100,
      duration: 120000, // 2 minutes
      queries: ['select', 'insert', 'update', 'complex', 'rls'],
    },
  },
  
  // Performance targets
  targets: {
    avgResponseTime: 100, // ms
    p95ResponseTime: 500, // ms
    p99ResponseTime: 1000, // ms
    errorRate: 0.01, // 1%
    throughput: 1000, // queries per second
  },
};

class DatabaseBenchmark {
  constructor() {
    this.pool = null;
    this.results = {};
    this.testData = {
      users: [],
      organizations: [],
      sessions: [],
    };
  }

  async initialize() {
    console.log('🚀 Initializing Database Benchmark...\n');
    
    this.pool = new DatabasePool(BENCHMARK_CONFIG.poolConfig);
    
    await new Promise(resolve => {
      this.pool.on('initialized', resolve);
    });
    
    // Create test data
    await this.setupTestData();
    console.log('✅ Benchmark initialization complete\n');
  }

  async setupTestData() {
    console.log('📊 Setting up test data...');
    
    // Create test users
    for (let i = 0; i < 1000; i++) {
      const user = await this.createTestUser(`bench-user-${i}@example.com`);
      this.testData.users.push(user);
    }
    
    // Create test organizations
    for (let i = 0; i < 100; i++) {
      const org = await this.createTestOrganization(`bench-org-${i}`);
      this.testData.organizations.push(org);
    }
    
    // Create memberships
    for (let i = 0; i < this.testData.users.length; i++) {
      const user = this.testData.users[i];
      const org = this.testData.organizations[i % this.testData.organizations.length];
      await this.createMembership(org.id, user.id, 'member');
    }
    
    console.log(`✅ Created ${this.testData.users.length} users and ${this.testData.organizations.length} organizations`);
  }

  async runAllBenchmarks() {
    console.log('🏁 Starting Database Performance Benchmarks\n');
    
    for (const [scenarioName, config] of Object.entries(BENCHMARK_CONFIG.scenarios)) {
      console.log(`\n=== ${scenarioName.toUpperCase()} LOAD TEST ===`);
      console.log(`Concurrent connections: ${config.concurrent}`);
      console.log(`Duration: ${config.duration / 1000}s`);
      console.log(`Query types: ${config.queries.join(', ')}\n`);
      
      const results = await this.runScenario(scenarioName, config);
      this.results[scenarioName] = results;
      
      this.printScenarioResults(scenarioName, results);
    }
    
    console.log('\n=== BENCHMARK SUMMARY ===');
    this.printSummary();
    
    await this.validatePerformanceTargets();
  }

  async runScenario(scenarioName, config) {
    const startTime = Date.now();
    const endTime = startTime + config.duration;
    const workers = [];
    const results = {
      totalQueries: 0,
      totalErrors: 0,
      responseTimes: [],
      queryTypes: {},
      startTime,
      endTime: null,
      duration: 0,
    };

    // Initialize query type counters
    config.queries.forEach(type => {
      results.queryTypes[type] = { count: 0, errors: 0, totalTime: 0 };
    });

    // Start worker promises
    for (let i = 0; i < config.concurrent; i++) {
      workers.push(this.runWorker(i, config, endTime, results));
    }

    // Wait for all workers to complete
    await Promise.all(workers);
    
    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    
    return results;
  }

  async runWorker(workerId, config, endTime, results) {
    while (Date.now() < endTime) {
      const queryType = config.queries[Math.floor(Math.random() * config.queries.length)];
      const startTime = Date.now();
      
      try {
        await this.executeQuery(queryType);
        
        const responseTime = Date.now() - startTime;
        results.responseTimes.push(responseTime);
        results.totalQueries++;
        results.queryTypes[queryType].count++;
        results.queryTypes[queryType].totalTime += responseTime;
        
      } catch (error) {
        results.totalErrors++;
        results.queryTypes[queryType].errors++;
        
        // Log errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error(`Worker ${workerId} error:`, error.message);
        }
      }
      
      // Small delay to prevent overwhelming
      await this.sleep(Math.random() * 10);
    }
  }

  async executeQuery(queryType) {
    const randomUser = this.getRandomUser();
    const randomOrg = this.getRandomOrganization();
    
    switch (queryType) {
      case 'select':
        return await this.benchmarkSelect(randomUser, randomOrg);
      
      case 'insert':
        return await this.benchmarkInsert(randomUser, randomOrg);
      
      case 'update':
        return await this.benchmarkUpdate(randomUser, randomOrg);
      
      case 'complex':
        return await this.benchmarkComplexQuery(randomUser, randomOrg);
      
      case 'rls':
        return await this.benchmarkRLSQuery(randomUser, randomOrg);
      
      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }
  }

  async benchmarkSelect(user, org) {
    // Simple select query
    return await this.pool.query(
      'SELECT id, email, status FROM users WHERE id = $1',
      [user.id]
    );
  }

  async benchmarkInsert(user, org) {
    // Insert audit log
    return await this.pool.query(`
      INSERT INTO audit_logs (org_id, actor_user_id, action, details) 
      VALUES ($1, $2, $3, $4)
    `, [org.id, user.id, 'benchmark.test', JSON.stringify({ benchmark: true })]);
  }

  async benchmarkUpdate(user, org) {
    // Update user metadata
    const metadata = { lastBenchmark: Date.now(), random: Math.random() };
    return await this.pool.query(
      'UPDATE users SET metadata = $1 WHERE id = $2',
      [JSON.stringify(metadata), user.id]
    );
  }

  async benchmarkComplexQuery(user, org) {
    // Complex join query
    return await this.pool.query(`
      SELECT 
        u.id, u.email, u.status,
        o.id as org_id, o.name as org_name,
        m.role, m.joined_at,
        COUNT(s.jti) as session_count
      FROM users u
      JOIN memberships m ON u.id = m.user_id
      JOIN organizations o ON m.org_id = o.id
      LEFT JOIN sessions s ON u.id = s.user_id AND s.revoked_at IS NULL
      WHERE u.id = $1
      GROUP BY u.id, u.email, u.status, o.id, o.name, m.role, m.joined_at
    `, [user.id]);
  }

  async benchmarkRLSQuery(user, org) {
    // Test RLS performance
    await this.pool.setRLSContext(user.id, org.id);
    
    try {
      return await this.pool.query(`
        SELECT COUNT(*) as member_count 
        FROM memberships 
        WHERE org_id = $1
      `, [org.id]);
    } finally {
      await this.pool.clearRLSContext();
    }
  }

  printScenarioResults(scenarioName, results) {
    const durationSeconds = results.duration / 1000;
    const qps = results.totalQueries / durationSeconds;
    const errorRate = results.totalErrors / results.totalQueries;
    
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
    console.log(`   Error Rate: ${(errorRate * 100).toFixed(2)}%`);
    console.log(`   Response Times:`);
    console.log(`     Average: ${avg.toFixed(1)}ms`);
    console.log(`     P50: ${p50}ms`);
    console.log(`     P95: ${p95}ms`);
    console.log(`     P99: ${p99}ms`);
    
    console.log(`   Query Breakdown:`);
    Object.entries(results.queryTypes).forEach(([type, stats]) => {
      const avgTime = stats.count > 0 ? stats.totalTime / stats.count : 0;
      console.log(`     ${type}: ${stats.count} queries, ${avgTime.toFixed(1)}ms avg, ${stats.errors} errors`);
    });
  }

  printSummary() {
    const scenarios = Object.keys(this.results);
    
    console.log('\n📈 Performance Summary:');
    console.log('Scenario'.padEnd(15) + 'QPS'.padEnd(10) + 'Avg(ms)'.padEnd(10) + 'P95(ms)'.padEnd(10) + 'Errors'.padEnd(10));
    console.log('-'.repeat(55));
    
    scenarios.forEach(scenario => {
      const results = this.results[scenario];
      const durationSeconds = results.duration / 1000;
      const qps = results.totalQueries / durationSeconds;
      const errorRate = results.totalErrors / results.totalQueries;
      
      const sortedTimes = results.responseTimes.sort((a, b) => a - b);
      const avg = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
      const p95 = this.calculatePercentile(sortedTimes, 95);
      
      console.log(
        scenario.padEnd(15) + 
        qps.toFixed(1).padEnd(10) + 
        avg.toFixed(1).padEnd(10) + 
        p95.toString().padEnd(10) + 
        `${(errorRate * 100).toFixed(2)}%`.padEnd(10)
      );
    });
  }

  async validatePerformanceTargets() {
    console.log('\n🎯 Validating Performance Targets:');
    
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
    
    const checks = [
      { name: 'Average Response Time', value: avg, target: BENCHMARK_CONFIG.targets.avgResponseTime, unit: 'ms', operator: '<=' },
      { name: 'P95 Response Time', value: p95, target: BENCHMARK_CONFIG.targets.p95ResponseTime, unit: 'ms', operator: '<=' },
      { name: 'P99 Response Time', value: p99, target: BENCHMARK_CONFIG.targets.p99ResponseTime, unit: 'ms', operator: '<=' },
      { name: 'Error Rate', value: errorRate * 100, target: BENCHMARK_CONFIG.targets.errorRate * 100, unit: '%', operator: '<=' },
      { name: 'Throughput', value: qps, target: BENCHMARK_CONFIG.targets.throughput, unit: 'qps', operator: '>=' },
    ];
    
    let allPassed = true;
    
    checks.forEach(check => {
      const passed = check.operator === '<=' ? check.value <= check.target : check.value >= check.target;
      const status = passed ? '✅' : '❌';
      allPassed = allPassed && passed;
      
      console.log(`${status} ${check.name}: ${check.value.toFixed(1)}${check.unit} (target: ${check.operator} ${check.target}${check.unit})`);
    });
    
    if (allPassed) {
      console.log('\n🎉 All performance targets met!');
    } else {
      console.log('\n⚠️  Some performance targets not met. Consider optimization.');
    }
  }

  calculatePercentile(sortedArray, percentile) {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index] || 0;
  }

  getRandomUser() {
    return this.testData.users[Math.floor(Math.random() * this.testData.users.length)];
  }

  getRandomOrganization() {
    return this.testData.organizations[Math.floor(Math.random() * this.testData.organizations.length)];
  }

  async createTestUser(email) {
    const result = await this.pool.query(
      'INSERT INTO users (email, status, email_verified) VALUES ($1, $2, $3) RETURNING *',
      [email, 'active', true]
    );
    return result.rows[0];
  }

  async createTestOrganization(slug) {
    const result = await this.pool.query(
      'INSERT INTO organizations (slug, name) VALUES ($1, $2) RETURNING *',
      [slug, `Benchmark Org ${slug}`]
    );
    return result.rows[0];
  }

  async createMembership(orgId, userId, role) {
    await this.pool.query(`
      INSERT INTO memberships (org_id, user_id, role, joined_at) 
      VALUES ($1, $2, $3, now())
    `, [orgId, userId, role]);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up benchmark data...');
    
    try {
      // Clean up in dependency order
      await this.pool.query("DELETE FROM audit_logs WHERE details @> '{\"benchmark\": true}'");
      await this.pool.query("DELETE FROM memberships WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'bench-%')");
      await this.pool.query("DELETE FROM organizations WHERE slug LIKE 'bench-org-%'");
      await this.pool.query("DELETE FROM users WHERE email LIKE 'bench-%'");
      
      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }
    
    await this.pool.close();
  }
}

// CLI interface
async function main() {
  const benchmark = new DatabaseBenchmark();
  
  try {
    await benchmark.initialize();
    await benchmark.runAllBenchmarks();
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
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
  console.log('\n⏹️  Benchmark interrupted');
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { DatabaseBenchmark };
