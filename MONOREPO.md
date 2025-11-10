# 🚀 Truxe Monorepo

Welcome to the Truxe monorepo! This document explains the structure, setup, and workflows.

## 📋 What Changed?

We migrated from a multi-repo setup to a **monorepo** using **pnpm workspaces** and **Turborepo**.

### Before (Multi-repo):
```
truxe/                    # API + Root scripts
truxe-website/            # Separate repo (truxe-website)
truxe-react/              # Component library (in packages/)
```

### After (Monorepo):
```
truxe/
├── apps/
│   ├── api/              # Backend API (@truxe/api)
│   └── admin/            # Admin Dashboard (@truxe/admin)
├── packages/
│   ├── types/            # Shared TypeScript types (@truxe/types)
│   ├── react/            # React component library (@truxe/react)
│   ├── website/          # Marketing website (@truxe/website)
│   └── config/           # Shared configuration (future)
├── pnpm-workspace.yaml   # Workspace definition
├── turbo.json            # Turborepo configuration
└── package.json          # Root package scripts
```

## 🎯 Benefits

### 1. **Shared Types** ✅
```typescript
// packages/types/src/user.ts
export interface User {
  id: string;
  email: string;
}

// apps/api/src/routes/auth.js
import { User } from '@truxe/types';

// packages/website/src/components/Profile.tsx
import { User } from '@truxe/types';

// packages/react/src/hooks/useUser.ts
import { User } from '@truxe/types';
```
**Result:** Single source of truth for all types!

### 2. **Atomic Commits** ✅
```bash
git commit -m "feat: add OAuth provider to API, React lib, and website"
# One commit updates all 3 packages!
```

### 3. **Simplified Development** ✅
```bash
# One command to start everything:
pnpm dev

# Run specific package:
pnpm api:dev         # Just API
pnpm website:dev     # Just website
pnpm react:dev       # Just React Storybook
```

### 4. **Better CI/CD** ✅
```yaml
# Only build changed packages!
turbo run build --filter=[HEAD^1]
```

## 🏗️ Structure

### Apps (Deployable Applications)

#### `apps/api/` - Backend API
- **Package:** `@truxe/api`
- **Tech:** Node.js + Fastify
- **Port:** 87001 (external) → 3001 (internal)
- **Start:** `pnpm api:dev`

#### `apps/admin/` - Admin Dashboard
- **Package:** `@truxe/admin`
- **Tech:** React + Storybook
- **Start:** `pnpm admin:dev`

### Packages (Shared Libraries)

#### `packages/types/` - TypeScript Types
- **Package:** `@truxe/types`
- **Purpose:** Shared type definitions
- **Exports:** User, Session, Organization types
- **Import:** `import { User } from '@truxe/types'`

#### `packages/react/` - React Component Library
- **Package:** `@truxe/react`
- **Tech:** React + TypeScript + Storybook
- **Start:** `pnpm react:dev`

#### `packages/website/` - Marketing Website
- **Package:** `@truxe/website`
- **Tech:** Next.js 14 + TailwindCSS
- **Port:** 3002
- **Start:** `pnpm website:dev`
- **Note:** Rebranded from truxe-website

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Installation
```bash
# Install all dependencies (root + all workspaces)
pnpm install

# This will install dependencies for:
# - Root workspace
# - apps/api
# - apps/admin
# - packages/types
# - packages/react
# - packages/website
```

### Development

#### Start All Services
```bash
pnpm dev
# Starts:
# - API (port 87001)
# - Website (port 3002)
# - Admin dashboard
# - React Storybook
```

#### Start Individual Services
```bash
# API only
pnpm api:dev

# Website only
pnpm website:dev

# Admin dashboard only
pnpm admin:dev

# React Storybook only
pnpm react:dev
```

### Build

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @truxe/website build
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @truxe/api test
```

## 📦 Package Management

### Adding Dependencies

#### Add to Root (devDependencies)
```bash
pnpm add -Dw <package>
# Example: pnpm add -Dw eslint
```

#### Add to Specific Package
```bash
pnpm --filter @truxe/website add <package>
# Example: pnpm --filter @truxe/website add axios
```

#### Add Workspace Dependency
```bash
# In packages/website/package.json:
{
  "dependencies": {
    "@truxe/types": "workspace:*"
  }
}

# Then: pnpm install
```

### Removing Dependencies
```bash
pnpm --filter @truxe/website remove <package>
```

## 🛠️ Scripts

### Root Scripts (package.json)

```bash
pnpm dev              # Start all packages in dev mode
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm test             # Test all packages
pnpm type-check       # TypeScript check all packages
pnpm clean            # Clean build artifacts

# Specific packages:
pnpm api:dev          # Start API only
pnpm website:dev      # Start website only
pnpm admin:dev        # Start admin only
pnpm react:dev        # Start React Storybook

# Utilities:
pnpm port:check       # Check port availability
pnpm port:validate    # Validate port configuration
pnpm docker:up        # Start Docker services
pnpm db:migrate       # Run database migrations
```

### Turborepo Benefits

Turborepo caches build outputs and only rebuilds changed packages:

```bash
# First build - builds everything
pnpm build
# ✓ @truxe/types (5s)
# ✓ @truxe/react (12s)
# ✓ @truxe/website (18s)
# ✓ @truxe/api (8s)

# Second build - instant! (cache hit)
pnpm build
# ✓ @truxe/types (CACHED)
# ✓ @truxe/react (CACHED)
# ✓ @truxe/website (CACHED)
# ✓ @truxe/api (CACHED)

# Change only website - only rebuilds website
# (edit packages/website/app/page.tsx)
pnpm build
# ✓ @truxe/types (CACHED)
# ✓ @truxe/react (CACHED)
# ✓ @truxe/website (18s) ← rebuilt
# ✓ @truxe/api (CACHED)
```

## 🔗 Cross-Package Dependencies

### Using @truxe/types in Website

```typescript
// packages/website/package.json
{
  "dependencies": {
    "@truxe/types": "workspace:*"
  }
}

// packages/website/src/components/UserProfile.tsx
import type { User } from '@truxe/types';

interface Props {
  user: User; // Type-safe!
}

export function UserProfile({ user }: Props) {
  return <div>{user.email}</div>;
}
```

### Using @truxe/types in API

```javascript
// apps/api/package.json
{
  "dependencies": {
    "@truxe/types": "workspace:*"
  }
}

// apps/api/src/routes/users.js
/**
 * @typedef {import('@truxe/types').User} User
 */

/**
 * @returns {Promise<User>}
 */
async function getUser(id) {
  // ...
}
```

## 📁 Adding New Packages

### 1. Create Package Directory
```bash
mkdir -p packages/my-package
cd packages/my-package
```

### 2. Create package.json
```json
{
  "name": "@truxe/my-package",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

### 3. Install Dependencies
```bash
pnpm install
# pnpm will automatically detect the new package
```

### 4. Use in Other Packages
```json
{
  "dependencies": {
    "@truxe/my-package": "workspace:*"
  }
}
```

## 🚢 Deployment

### Build for Production
```bash
# Build all packages
pnpm build

# Build outputs:
# - apps/api: No build needed (Node.js)
# - apps/admin: dist/
# - packages/react: dist/
# - packages/website: .next/
```

### Deploy Individual Apps

#### API
```bash
pnpm --filter @truxe/api build
# Deploy apps/api to server
```

#### Website
```bash
pnpm --filter @truxe/website build
# Deploy packages/website/.next to Vercel
```

## 🐛 Troubleshooting

### "Cannot find module '@truxe/types'"

**Solution:**
```bash
# Make sure package.json has workspace dependency:
{
  "dependencies": {
    "@truxe/types": "workspace:*"
  }
}

# Then reinstall:
pnpm install
```

### "Port already in use"

**Solution:**
```bash
# Check what's using the port:
pnpm port:check

# Kill processes using Truxe ports:
pnpm port:kill
```

### Turbo cache issues

**Solution:**
```bash
# Clear turbo cache:
rm -rf .turbo

# Force rebuild:
pnpm build --force
```

### pnpm workspace not detected

**Solution:**
```bash
# Check pnpm-workspace.yaml exists
cat pnpm-workspace.yaml

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 📚 Best Practices

### 1. Use Shared Types
```typescript
// ✅ Good
import { User } from '@truxe/types';

// ❌ Bad
interface User {
  id: string;
  email: string;
}
```

### 2. Use pnpm Filters
```bash
# ✅ Good - Only installs for specific package
pnpm --filter @truxe/website add lodash

# ❌ Bad - Might install in wrong package
cd packages/website && npm install lodash
```

### 3. Commit Atomically
```bash
# ✅ Good - Commit related changes together
git commit -m "feat: add OAuth provider to API, website, and React lib"

# ❌ Bad - Separate commits for related changes
git commit -m "feat: add OAuth to API"
git commit -m "feat: add OAuth to website"
```

### 4. Use Turbo for Scripts
```bash
# ✅ Good - Runs in parallel, uses cache
pnpm build

# ❌ Bad - Runs serially, no cache
cd apps/api && npm run build
cd packages/website && npm run build
```

## 🔄 Migration Notes

### From Old Setup

1. **truxe-website** → `packages/website`
   - ✅ Rebranded (Truxe → Truxe)
   - ✅ Package name: `@truxe/website`
   - ✅ Port: 3002 (to avoid conflicts)

2. **api/** → `apps/api`
   - ✅ Package name: `@truxe/api`
   - ✅ No code changes needed

3. **ui/** → `apps/admin`
   - ✅ Package name: `@truxe/admin`
   - ✅ Renamed for clarity

4. **packages/react** → Still in `packages/react`
   - ✅ No changes needed

5. **New:** `packages/types`
   - ✅ Shared TypeScript types
   - ✅ Used across all packages

## 📊 Stats

- **7 packages** in workspace
- **3 apps** (deployable)
- **4 packages** (libraries)
- **1 shared types** package

## 🤝 Contributing

When adding new features:

1. **Add types first** in `packages/types`
2. **Implement in API** (`apps/api`)
3. **Add to React lib** (`packages/react`)
4. **Update website** (`packages/website`)
5. **Commit atomically**

## 📞 Support

- **Documentation:** [docs/](docs/)
- **GitHub:** [github.com/truxeio/truxe](https://github.com/truxeio/truxe)

---

*Monorepo powered by pnpm + Turborepo*
