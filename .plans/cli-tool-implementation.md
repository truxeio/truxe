# CLI Tool Implementation Plan

**Branch:** `feature/cli-tool`
**Goal:** Complete v0.4 roadmap item - "CLI tool for local development"
**Status:** Planning
**Started:** 2025-11-10

---

## Overview

Create `@truxe/cli` - a command-line tool to simplify local development and deployment of Truxe authentication server.

**Target User Experience:**
```bash
# Install globally
npm install -g @truxe/cli

# Initialize new project
truxe init my-auth-server
cd my-auth-server

# Generate JWT keys
truxe keys generate

# Start development server
truxe dev

# Run database migrations
truxe migrate

# Check system health
truxe health
```

---

## Phase 1: Project Setup ⏳

### 1.1 Create Package Structure
- [ ] Create `packages/cli/` directory
- [ ] Initialize `package.json` with proper metadata
- [ ] Setup TypeScript configuration
- [ ] Configure build system (tsup or esbuild)
- [ ] Add CLI binary entry point in package.json

**Package Name:** `@truxe/cli`
**Version:** `0.1.0`
**License:** MIT (dev tool, not BSL)

### 1.2 Setup Development Environment
- [ ] Add workspace dependencies
- [ ] Configure ESLint for CLI package
- [ ] Setup testing with Vitest
- [ ] Add build scripts to root package.json

**Files to Create:**
```
packages/cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Main CLI entry
│   ├── commands/         # Command implementations
│   ├── utils/            # Helper functions
│   └── templates/        # Project templates
├── bin/
│   └── truxe.js          # Binary wrapper
└── README.md
```

---

## Phase 2: Core CLI Framework ⏳

### 2.1 CLI Framework Selection
**Options:**
- ✅ **commander** (most popular, 29k stars)
- ❌ yargs (more complex API)
- ❌ oclif (too heavy for our needs)

**Decision:** Use `commander` for simplicity and popularity.

### 2.2 Setup Base CLI Structure
- [ ] Install commander, chalk, inquirer, ora
- [ ] Create main CLI parser
- [ ] Setup help text and version display
- [ ] Add global error handling
- [ ] Implement logging utilities (with colors)

**Dependencies:**
```json
{
  "commander": "^11.0.0",      // CLI framework
  "chalk": "^5.3.0",           // Colored output
  "inquirer": "^9.2.0",        // Interactive prompts
  "ora": "^7.0.0",             // Spinners
  "execa": "^8.0.0",           // Execute commands
  "fs-extra": "^11.1.0",       // File system utilities
  "dotenv": "^16.3.0"          // Environment variables
}
```

### 2.3 Create Reusable Utilities
- [ ] Logger utility (info, success, error, warning)
- [ ] File system helpers (copy, template, mkdir)
- [ ] Command executor wrapper
- [ ] Environment variable validator
- [ ] Port availability checker

---

## Phase 3: Command Implementation ⏳

### 3.1 `truxe init` Command
**Purpose:** Initialize a new Truxe project

**Features:**
- [ ] Interactive prompts for project configuration
  - Project name
  - Database type (PostgreSQL / MySQL)
  - Redis configuration
  - Email provider (SMTP / Brevo / SendGrid / None)
  - OAuth providers (GitHub, Google, Apple, etc.)
- [ ] Clone base template or copy from monorepo
- [ ] Generate `.env` file from template
- [ ] Create `docker-compose.yml`
- [ ] Install dependencies automatically
- [ ] Print next steps

**Template Structure:**
```
my-truxe-project/
├── .env
├── .env.example
├── docker-compose.yml
├── api/                    # Symlink or copy from apps/api
├── database/               # Migrations
└── README.md
```

**Implementation:**
```typescript
// src/commands/init.ts
export async function init(projectName?: string) {
  // 1. Prompt for project name if not provided
  // 2. Ask configuration questions
  // 3. Create project directory
  // 4. Copy template files
  // 5. Generate .env from answers
  // 6. Initialize git repo
  // 7. Install dependencies
  // 8. Print success message with next steps
}
```

---

### 3.2 `truxe dev` Command
**Purpose:** Start development server with hot reload

**Features:**
- [ ] Check environment variables
- [ ] Verify PostgreSQL connection
- [ ] Verify Redis connection
- [ ] Start Docker services if needed
- [ ] Run database migrations
- [ ] Start API server with nodemon
- [ ] Watch for file changes
- [ ] Pretty print logs with colors
- [ ] Handle SIGINT gracefully

**Implementation:**
```typescript
// src/commands/dev.ts
export async function dev() {
  // 1. Load .env file
  // 2. Validate required env vars
  // 3. Check port availability
  // 4. Start Docker if not running
  // 5. Wait for DB/Redis to be ready
  // 6. Run migrations
  // 7. Start API server
  // 8. Setup file watchers
}
```

---

### 3.3 `truxe keys generate` Command
**Purpose:** Generate RSA key pair for JWT signing

**Features:**
- [ ] Generate 2048-bit RSA key pair
- [ ] Save to `keys/private.pem` and `keys/public.pem`
- [ ] Update `.env` with key paths
- [ ] Set proper file permissions (600 for private key)
- [ ] Display key fingerprint

**Implementation:**
```typescript
// src/commands/keys.ts
import { generateKeyPairSync } from 'crypto';

export async function generateKeys() {
  // 1. Create keys/ directory
  // 2. Generate RSA key pair
  // 3. Write to files
  // 4. Set permissions
  // 5. Update .env
  // 6. Print success
}
```

---

### 3.4 `truxe migrate` Command
**Purpose:** Run database migrations

**Features:**
- [ ] List available migrations
- [ ] Run pending migrations
- [ ] Rollback last migration
- [ ] Create new migration file
- [ ] Show migration status

**Subcommands:**
```bash
truxe migrate up           # Run pending migrations
truxe migrate down         # Rollback last migration
truxe migrate status       # Show migration status
truxe migrate create NAME  # Create new migration
```

**Implementation:**
```typescript
// src/commands/migrate.ts
export async function migrate(action: 'up' | 'down' | 'status' | 'create') {
  // 1. Load database connection
  // 2. Check migrations table
  // 3. Execute action
  // 4. Print results
}
```

---

### 3.5 `truxe health` Command
**Purpose:** Check system health and dependencies

**Features:**
- [ ] Check Node.js version (>= 20.0.0)
- [ ] Check npm/pnpm version
- [ ] Check Docker availability
- [ ] Check PostgreSQL connection
- [ ] Check Redis connection
- [ ] Check port availability (87001, 87032, 87079)
- [ ] Verify environment variables
- [ ] Display color-coded status report

**Implementation:**
```typescript
// src/commands/health.ts
export async function health() {
  const checks = [
    { name: 'Node.js', check: checkNodeVersion },
    { name: 'Docker', check: checkDocker },
    { name: 'PostgreSQL', check: checkPostgres },
    { name: 'Redis', check: checkRedis },
    { name: 'Ports', check: checkPorts },
    { name: 'Environment', check: checkEnv },
  ];

  for (const { name, check } of checks) {
    const result = await check();
    printCheckResult(name, result);
  }
}
```

---

### 3.6 `truxe config` Command (Optional)
**Purpose:** Manage configuration interactively

**Features:**
- [ ] Display current configuration
- [ ] Edit environment variables
- [ ] Validate configuration
- [ ] Test connections (DB, Redis, Email)

---

### 3.7 `truxe logs` Command (Optional)
**Purpose:** Tail server logs

**Features:**
- [ ] Follow API server logs
- [ ] Follow Docker logs
- [ ] Filter by level (info, warn, error)

---

## Phase 4: Testing ⏳

### 4.1 Unit Tests
- [ ] Test each command in isolation
- [ ] Mock file system operations
- [ ] Mock external commands
- [ ] Test error handling
- [ ] Test validation logic

### 4.2 Integration Tests
- [ ] Test `truxe init` creates proper structure
- [ ] Test `truxe keys generate` creates valid keys
- [ ] Test `truxe migrate` runs migrations
- [ ] Test `truxe health` detects issues

### 4.3 Manual Testing
- [ ] Test on clean system
- [ ] Test with existing project
- [ ] Test error scenarios
- [ ] Test help text and --help flags
- [ ] Test on macOS
- [ ] Test on Linux (optional)
- [ ] Test on Windows (optional)

---

## Phase 5: Documentation ⏳

### 5.1 CLI README
- [ ] Installation instructions
- [ ] Command reference
- [ ] Examples for each command
- [ ] Troubleshooting guide
- [ ] Contributing guide

### 5.2 Main Documentation Update
- [ ] Update README.md with CLI usage
- [ ] Update Quick Start guide
- [ ] Add CLI to documentation site
- [ ] Create video tutorial (optional)

### 5.3 Help Text
- [ ] Add detailed help for each command
- [ ] Add examples in help text
- [ ] Add --help flag to all commands

---

## Phase 6: Publishing ⏳

### 6.1 Pre-publish Checklist
- [ ] All tests passing
- [ ] Build successful
- [ ] package.json metadata complete
- [ ] README.md complete
- [ ] CHANGELOG.md created
- [ ] License file (MIT)
- [ ] .npmignore configured

### 6.2 npm Publish
- [ ] Build package (`npm run build`)
- [ ] Test installation locally (`npm link`)
- [ ] Publish to npm (`npm publish --access public`)
- [ ] Verify package on npmjs.com
- [ ] Test global installation (`npm i -g @truxe/cli`)

### 6.3 Post-publish
- [ ] Update root README.md
- [ ] Mark roadmap item as complete
- [ ] Announce on GitHub Discussions
- [ ] Tweet about it (optional)

---

## Technical Decisions

### 1. Package Manager
**Decision:** Support both npm and pnpm
**Reason:** Detect which one user prefers and use that

### 2. TypeScript vs JavaScript
**Decision:** TypeScript
**Reason:** Type safety, better developer experience

### 3. Build Tool
**Decision:** tsup (esbuild wrapper)
**Reason:** Fast, simple, bundles dependencies

### 4. Template Strategy
**Decision:** Copy from monorepo apps/api
**Reason:** Always up-to-date, no separate template repo needed

### 5. Docker Handling
**Decision:** Optional, auto-detect and start if needed
**Reason:** Flexibility for users with existing setups

---

## Dependencies

### Production Dependencies
```json
{
  "commander": "^11.0.0",
  "chalk": "^5.3.0",
  "inquirer": "^9.2.0",
  "ora": "^7.0.0",
  "execa": "^8.0.0",
  "fs-extra": "^11.1.0",
  "dotenv": "^16.3.0",
  "pg": "^8.11.0",
  "redis": "^4.6.0"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.3.0",
  "tsup": "^8.0.0",
  "vitest": "^1.0.4",
  "@types/node": "^20.10.0",
  "@types/fs-extra": "^11.0.4",
  "@types/inquirer": "^9.0.7"
}
```

---

## File Structure (Final)

```
packages/cli/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── CHANGELOG.md
├── LICENSE
├── .npmignore
├── bin/
│   └── truxe.js                # Binary entry point
├── src/
│   ├── index.ts                # Main CLI parser
│   ├── commands/
│   │   ├── init.ts             # truxe init
│   │   ├── dev.ts              # truxe dev
│   │   ├── keys.ts             # truxe keys
│   │   ├── migrate.ts          # truxe migrate
│   │   ├── health.ts           # truxe health
│   │   ├── config.ts           # truxe config (optional)
│   │   └── logs.ts             # truxe logs (optional)
│   ├── utils/
│   │   ├── logger.ts           # Colored logging
│   │   ├── fs.ts               # File system helpers
│   │   ├── exec.ts             # Command execution
│   │   ├── docker.ts           # Docker utilities
│   │   ├── ports.ts            # Port checking
│   │   ├── env.ts              # Environment validation
│   │   └── templates.ts        # Template rendering
│   └── templates/
│       ├── env.template         # .env template
│       ├── docker-compose.yml   # Docker compose template
│       └── README.template      # Project README template
├── dist/                       # Build output
└── test/
    ├── commands/
    └── utils/
```

---

## Success Criteria

### Must Have (v0.1.0)
- ✅ `truxe init` creates working project
- ✅ `truxe dev` starts server successfully
- ✅ `truxe keys generate` creates valid JWT keys
- ✅ `truxe migrate` runs database migrations
- ✅ `truxe health` checks system dependencies
- ✅ Published to npm as `@truxe/cli`
- ✅ Works on macOS and Linux

### Nice to Have (Future)
- ⏳ `truxe config` for interactive configuration
- ⏳ `truxe logs` for log tailing
- ⏳ `truxe deploy` for one-click deployment
- ⏳ `truxe test` for running test suite
- ⏳ Windows support
- ⏳ Auto-update checking
- ⏳ Telemetry (opt-in)

---

## Timeline Estimate

| Phase | Tasks | Time Estimate |
|-------|-------|---------------|
| Phase 1: Setup | Package structure, build config | 2 hours |
| Phase 2: Framework | CLI framework, utilities | 3 hours |
| Phase 3: Commands | Implement 5 core commands | 8 hours |
| Phase 4: Testing | Unit + integration tests | 4 hours |
| Phase 5: Documentation | README, help text, guides | 3 hours |
| Phase 6: Publishing | Publish to npm, verify | 2 hours |
| **Total** | | **22 hours** |

---

## Risk Assessment

### Low Risk
- ✅ Commander is stable and well-documented
- ✅ Template copying is straightforward
- ✅ Monorepo structure already exists

### Medium Risk
- ⚠️ Docker detection might be tricky
- ⚠️ Windows support needs testing
- ⚠️ Migration system integration

### High Risk
- ❌ None identified

---

## Notes

- Keep CLI simple and focused on developer experience
- Don't over-engineer - MVP first, iterate later
- Ensure excellent error messages with actionable suggestions
- Make it fast - no one likes slow CLIs
- Bundle all dependencies to avoid install issues
- Test on clean systems before publishing

---

## Checklist Progress

### Phase 1: Project Setup
- [ ] 1.1 Create Package Structure
- [ ] 1.2 Setup Development Environment

### Phase 2: Core CLI Framework
- [ ] 2.1 CLI Framework Selection
- [ ] 2.2 Setup Base CLI Structure
- [ ] 2.3 Create Reusable Utilities

### Phase 3: Command Implementation
- [ ] 3.1 `truxe init` Command
- [ ] 3.2 `truxe dev` Command
- [ ] 3.3 `truxe keys generate` Command
- [ ] 3.4 `truxe migrate` Command
- [ ] 3.5 `truxe health` Command

### Phase 4: Testing
- [ ] 4.1 Unit Tests
- [ ] 4.2 Integration Tests
- [ ] 4.3 Manual Testing

### Phase 5: Documentation
- [ ] 5.1 CLI README
- [ ] 5.2 Main Documentation Update
- [ ] 5.3 Help Text

### Phase 6: Publishing
- [ ] 6.1 Pre-publish Checklist
- [ ] 6.2 npm Publish
- [ ] 6.3 Post-publish

---

**Last Updated:** 2025-11-10
**Status:** Planning Complete - Ready to Start Implementation
