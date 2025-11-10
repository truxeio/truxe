# ADR-001: Technology Stack Selection

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Core Team  

## Context

Truxe requires a technology stack that enables rapid development while maintaining production-grade security, performance, and developer experience. The stack must support:

- Fast iteration and time-to-market (Ultra-MVP in 4 weeks)
- Type safety and maintainability
- High-performance authentication workloads
- Excellent developer tooling and ecosystem
- OpenAPI-first development for SDK generation
- Easy deployment and scaling

## Decision

We will use **Node.js + TypeScript + Fastify** as our core backend stack.

### Core Stack Components

#### Backend Runtime & Language
- **Node.js 20+** with **TypeScript 5.0+**
- **Fastify** as the web framework
- **@fastify/swagger** for OpenAPI specification generation

#### Database & Caching
- **PostgreSQL 15+** as primary database
- **Redis 7+** for caching and rate limiting
- Custom migration system with rollback support

#### Development & Tooling
- **pnpm** for package management and monorepo
- **ESLint + Prettier** for code quality
- **Vitest** for testing
- **Docker** for containerization

## Rationale

### Why Node.js + TypeScript?

#### ✅ Advantages
1. **Ecosystem Consistency:** CLI, SDK, UI components all in TypeScript
2. **Developer Productivity:** Excellent tooling, fast iteration cycles
3. **Type Safety:** Compile-time error detection, better refactoring
4. **Hiring Pool:** Large talent pool familiar with TypeScript
5. **Performance:** V8 engine provides excellent performance for I/O-heavy auth workloads
6. **Edge Deployment:** Native support for Vercel, Cloudflare Workers

#### ❌ Trade-offs
1. **Memory Usage:** Higher than Go/Rust, but acceptable for auth workloads
2. **CPU-Intensive Tasks:** Not optimal, but auth is primarily I/O-bound
3. **Ecosystem Maturity:** Some security libraries less mature than Java/.NET

### Why Fastify over Express/Koa?

#### ✅ Fastify Advantages
1. **Performance:** 2-3x faster than Express in benchmarks
2. **TypeScript-First:** Built with TypeScript, excellent type inference
3. **Schema Validation:** Built-in JSON Schema validation
4. **Plugin Architecture:** Clean, composable plugin system
5. **OpenAPI Integration:** `@fastify/swagger` generates specs automatically
6. **Modern Async/Await:** No callback hell, clean error handling

#### ❌ Express Comparison
- **Ecosystem:** Express has larger ecosystem, but Fastify ecosystem sufficient
- **Learning Curve:** Team familiar with Express, but Fastify learning curve minimal
- **Stability:** Express more battle-tested, but Fastify stable since v3

### Why PostgreSQL?

#### ✅ Advantages
1. **Row Level Security (RLS):** Built-in multi-tenant data isolation
2. **JSONB Support:** Flexible metadata storage with indexing
3. **ACID Compliance:** Critical for financial/audit data
4. **Extensions:** Rich ecosystem (uuid-ossp, pg_cron, etc.)
5. **Performance:** Excellent performance for read-heavy auth workloads
6. **Compliance:** Well-understood by auditors and compliance teams

#### ❌ Alternatives Considered
- **MySQL:** Lacks advanced JSON support and RLS
- **MongoDB:** No ACID guarantees, harder to ensure data consistency
- **SQLite:** Great for development, but limited for production multi-tenancy

### Why Redis?

#### ✅ Advantages
1. **Rate Limiting:** Atomic operations perfect for sliding window algorithms
2. **Session Storage:** Fast session lookup and invalidation
3. **Caching:** Reduce database load for frequently accessed data
4. **Pub/Sub:** Real-time features (webhooks, notifications)

## Implementation Details

### Project Structure
```
packages/
├── api/           # Fastify backend
├── cli/           # CLI tool
├── sdk/           # TypeScript SDK
├── ui/            # React components
└── shared/        # Shared types and utilities
```

### Key Dependencies
```json
{
  "fastify": "^4.24.0",
  "@fastify/swagger": "^8.12.0",
  "@fastify/type-provider-typebox": "^4.0.0",
  "pg": "^8.11.0",
  "redis": "^4.6.0",
  "jsonwebtoken": "^9.0.0",
  "argon2": "^0.31.0"
}
```

### OpenAPI-First Development
```typescript
// Schema-driven development
const LoginSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  orgSlug: Type.Optional(Type.String())
});

// Auto-generated OpenAPI spec
fastify.post('/auth/login', {
  schema: {
    body: LoginSchema,
    response: {
      200: LoginResponseSchema
    }
  }
}, async (request, reply) => {
  // Implementation
});
```

## Alternatives Considered

### FastAPI (Python)
#### ✅ Pros
- Excellent OpenAPI integration
- Strong typing with Pydantic
- Great performance
- Rich ecosystem for auth (passlib, python-jose)

#### ❌ Cons
- Different language from CLI/SDK/UI
- Slower development iteration
- Smaller talent pool for TypeScript-heavy team
- More complex deployment story

### Go + Gin/Fiber
#### ✅ Pros
- Excellent performance
- Strong concurrency model
- Single binary deployment
- Growing auth ecosystem

#### ❌ Cons
- Different language from frontend stack
- Less flexible than TypeScript for rapid iteration
- Smaller ecosystem for auth-specific libraries
- Team learning curve

### Rust + Axum/Actix
#### ✅ Pros
- Maximum performance and safety
- Excellent for security-critical applications
- Growing ecosystem

#### ❌ Cons
- Steep learning curve
- Slower development velocity
- Limited auth ecosystem
- Overkill for MVP timeline

## Consequences

### Positive
1. **Fast Development:** Single language across stack accelerates development
2. **Type Safety:** Compile-time error detection reduces bugs
3. **Developer Experience:** Excellent tooling and debugging experience
4. **Ecosystem:** Rich npm ecosystem for auth-related functionality
5. **Deployment:** Easy containerization and cloud deployment

### Negative
1. **Performance Ceiling:** May need to optimize or rewrite performance-critical parts later
2. **Memory Usage:** Higher baseline memory usage than compiled languages
3. **Dependency Management:** npm ecosystem can have security vulnerabilities

### Mitigation Strategies
1. **Performance Monitoring:** Implement comprehensive metrics from day one
2. **Security Audits:** Regular dependency audits with `npm audit` and Snyk
3. **Optimization Points:** Profile and optimize hot paths as needed
4. **Migration Path:** Architecture allows for gradual migration of performance-critical components

## Review Schedule

This decision will be reviewed in **6 months** (July 2024) based on:
- Performance metrics under production load
- Development velocity and team satisfaction
- Security audit results
- Community feedback and adoption

## References

- [Fastify Performance Benchmarks](https://www.fastify.io/benchmarks/)
- [PostgreSQL Row Level Security Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [TypeScript Performance Guidelines](https://github.com/microsoft/TypeScript/wiki/Performance)
