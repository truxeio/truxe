# Truxe Database Layer

Complete PostgreSQL database implementation for Truxe's authentication system with multi-tenant Row Level Security, comprehensive migration system, and performance optimization.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Tenant A      │  │   Tenant B      │  │  Tenant C    │ │
│  │   Context       │  │   Context       │  │  Context     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                  Connection Pool Layer                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │     Optimized for 100+ Concurrent Connections          │ │
│  │   • Health Monitoring  • Auto-retry  • Metrics         │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer (PostgreSQL)              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Row Level Security (RLS)                   │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │ │
│  │  │ Tenant A    │  │ Tenant B    │  │   Tenant C      │  │ │
│  │  │ Data        │  │ Data        │  │   Data          │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

### Core Tables

- **`users`** - User identities with email-based authentication
- **`organizations`** - Multi-tenant organizations with hierarchical support
- **`memberships`** - User-organization relationships with RBAC
- **`sessions`** - JWT session management with device tracking
- **`audit_logs`** - Immutable audit trail for compliance
- **`magic_link_challenges`** - Passwordless authentication tokens
- **`usage_metrics`** - Billing and rate limiting data
- **`rate_limits`** - Rate limiting storage (Redis alternative)

### Security Features

- **Row Level Security (RLS)** on all tenant-scoped tables
- **UUID primary keys** for all tables
- **Comprehensive constraints** and data validation
- **Audit trail** for all data modifications
- **Cross-tenant isolation** validation
- **SQL injection protection** via parameterized queries

## 🚀 Quick Start

### Prerequisites

- PostgreSQL 15+
- Node.js 18+
- npm or pnpm

### Installation

```bash
cd database
npm install
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your database credentials
nano .env
```

### Database Setup

```bash
# Run migrations
npm run migrate:up

# Verify setup
npm run migrate:status

# Run security tests
npm run test:security
```

## 🔄 Migration System

### Running Migrations

```bash
# Apply all pending migrations
npm run migrate:up

# Apply migrations up to specific version
npm run migrate:up 005

# Rollback to specific version
npm run migrate:down 003

# Check migration status
npm run migrate:status

# Validate migration integrity
npm run migrate:validate
```

### Creating New Migrations

```bash
# Create new migration
npm run migrate:create "add user preferences table"

# This creates:
# - migrations/XXX_add_user_preferences_table.sql
# - migrations/XXX_add_user_preferences_table_rollback.sql
```

### Migration Best Practices

1. **Always create rollback scripts**
2. **Test migrations on copy of production data**
3. **Use transactions for atomic operations**
4. **Document breaking changes**
5. **Validate data integrity after migrations**

## 🔐 Row Level Security (RLS)

### How RLS Works

RLS policies automatically filter database queries based on the current user context:

```javascript
// Set user context
await pool.setRLSContext(userId, orgId);

// This query automatically filters by organization
const users = await pool.query('SELECT * FROM users');
// Only returns users the current user can access
```

### RLS Policies

- **Organizations**: Users see only orgs they're members of
- **Memberships**: Users see memberships in their orgs
- **Sessions**: Users see only their own sessions
- **Audit Logs**: Only admins see audit logs for their orgs
- **Usage Metrics**: Only admins see metrics for their orgs

### Testing RLS

```bash
# Run comprehensive RLS tests
npm run test:security

# Test specific RLS scenarios
npm test -- --grep "Row Level Security"
```

## 🔌 Connection Pooling

### Pool Configuration

The database layer provides optimized connection pooling:

```javascript
const { getPool } = require('./connection');

// Get default pool
const pool = getPool();

// Execute query
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// Execute transaction
await pool.transaction(async (client) => {
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO memberships ...');
});
```

### Pool Settings by Environment

- **Development**: 2-10 connections
- **Test**: 1-5 connections  
- **Production**: 10-100 connections

### Health Monitoring

The pool automatically monitors:
- Connection health checks
- Query performance metrics
- Error rates and retry logic
- Connection utilization

## 📈 Performance Optimization

### Indexes

Comprehensive indexing strategy:

```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status) WHERE status != 'active';

-- Multi-tenant queries
CREATE INDEX idx_memberships_user_org ON memberships(user_id, org_id);
CREATE INDEX idx_sessions_active ON sessions(user_id, expires_at) 
  WHERE revoked_at IS NULL;

-- Audit queries
CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at);
```

### Query Optimization

- **Always include tenant context** in WHERE clauses
- **Use partial indexes** for filtered queries
- **Leverage JSONB operators** efficiently
- **Monitor query performance** with pg_stat_statements

### Benchmarking

```bash
# Run performance benchmarks
npm run benchmark

# Test different load scenarios:
# - Light load: 10 concurrent, 30s
# - Medium load: 50 concurrent, 60s  
# - Heavy load: 100 concurrent, 120s
```

## 🧪 Testing

### Test Categories

1. **Unit Tests**: Individual function testing
2. **Integration Tests**: Database interaction testing
3. **Security Tests**: RLS and isolation validation
4. **Performance Tests**: Load and benchmark testing

### Running Tests

```bash
# Run all tests
npm test

# Run security validation
npm run test:security

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Database Setup

Tests require a separate test database:

```bash
# Set test database URL
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/truxe_test"

# Run tests
npm test
```

## 🔒 Security Features

### Multi-Tenant Isolation

- **Database-level isolation** via RLS policies
- **Application-level validation** with double-checking
- **Cross-tenant access prevention** with automated testing
- **Audit trail** for all tenant operations

### SQL Injection Protection

- **Parameterized queries** for all database operations
- **Input validation** at application layer
- **JSONB sanitization** for flexible data
- **Automated testing** for injection attempts

### Data Integrity

- **Foreign key constraints** with proper cascading
- **Check constraints** for data validation
- **Unique constraints** for critical fields
- **Trigger-based auditing** for change tracking

## 📊 Monitoring & Observability

### Metrics Collection

The database layer automatically collects:

```javascript
const metrics = pool.getMetrics();
console.log(metrics);
// {
//   totalQueries: 15420,
//   totalErrors: 12,
//   averageQueryTime: 45.2,
//   activeConnections: 8,
//   poolUtilization: 0.16
// }
```

### Health Checks

Automated health monitoring:
- **Connection health**: Periodic connection testing
- **Query performance**: Response time tracking
- **Error monitoring**: Automatic error detection
- **Pool utilization**: Connection usage tracking

### Alerting Integration

```javascript
pool.on('error', (error) => {
  // Send to monitoring system
  console.error('Database error:', error);
});

pool.on('healthCheck', ({ status, duration }) => {
  if (status === 'unhealthy') {
    // Trigger alert
  }
});
```

## 🛠️ Maintenance

### Regular Maintenance Tasks

1. **Analyze database statistics**: `ANALYZE;`
2. **Vacuum tables**: `VACUUM ANALYZE;`
3. **Monitor index usage**: Check `pg_stat_user_indexes`
4. **Clean expired data**: Run cleanup functions
5. **Monitor disk usage**: Check table and index sizes

### Automated Cleanup

```sql
-- Clean expired sessions, magic links, rate limits
SELECT cleanup_expired_data();
```

### Performance Monitoring

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

## 🚨 Troubleshooting

### Common Issues

#### Connection Pool Exhaustion
```javascript
// Symptoms: "Client has already been taken" errors
// Solution: Check for unreleased connections
pool.on('error', (error) => {
  if (error.message.includes('Client has already been taken')) {
    console.log('Pool metrics:', pool.getMetrics());
  }
});
```

#### RLS Policy Violations
```javascript
// Symptoms: Empty query results when data should exist
// Solution: Check RLS context
await pool.setRLSContext(userId, orgId);
console.log('Current user:', await pool.query('SELECT current_setting(\'app.current_user_id\')'));
```

#### Migration Failures
```bash
# Check migration status
npm run migrate:status

# Validate migration integrity  
npm run migrate:validate

# Check migration logs
SELECT * FROM migration_log WHERE status = 'failed';
```

#### Performance Issues
```sql
-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;

-- Check for table bloat
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 📚 API Reference

### DatabasePool Class

```javascript
const { DatabasePool } = require('./connection');

const pool = new DatabasePool({
  retryAttempts: 3,
  healthCheckInterval: 30000,
  enableMetrics: true,
  enableRLS: true
});

// Query execution
await pool.query(sql, params);

// Transaction execution  
await pool.transaction(async (client) => {
  // Your transaction logic
});

// RLS context management
await pool.setRLSContext(userId, orgId);
await pool.clearRLSContext();

// Metrics and monitoring
const metrics = pool.getMetrics();
pool.on('error', handler);
pool.on('healthCheck', handler);
```

### Migration Runner

```javascript
const { MigrationRunner } = require('./migrate');

const runner = new MigrationRunner();
await runner.up('005');
await runner.down('003');
await runner.validate();
```

## 🤝 Contributing

### Development Setup

1. **Clone repository**
2. **Install dependencies**: `npm install`
3. **Set up test database**: Copy `.env.example` to `.env`
4. **Run tests**: `npm test`
5. **Run linting**: `npm run lint`

### Code Standards

- **ESLint configuration** with Standard rules
- **Jest testing** with coverage requirements
- **Comprehensive documentation** for all functions
- **Security-first approach** for all database operations

### Pull Request Process

1. **Create feature branch**
2. **Add tests** for new functionality
3. **Update documentation**
4. **Run full test suite**
5. **Request security review** for database changes

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: See `/docs` directory
- **Issues**: GitHub Issues
- **Security**: security@truxe.io
- **General**: support@truxe.io
