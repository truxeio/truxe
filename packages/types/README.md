# @truxe/types

Shared TypeScript type definitions for the Truxe monorepo.

## Purpose

This package provides centralized type definitions used across all Truxe packages:
- `apps/api` - Backend API
- `apps/admin` - Admin dashboard
- `packages/react` - React component library
- `packages/website` - Marketing website

## Usage

```typescript
import { User, Session, Organization } from '@truxe/types';
import type { UserStatus, OrganizationRole } from '@truxe/types';
```

### Specific imports

```typescript
import { User, CreateUserInput } from '@truxe/types/user';
import { Session, TokenPair } from '@truxe/types/auth';
import { Organization, OrganizationMember } from '@truxe/types/organization';
```

## Structure

```
src/
├── index.ts          # Main export
├── user.ts           # User-related types
├── auth.ts           # Authentication types (Session, Token, MFA)
└── organization.ts   # Organization and RBAC types
```

## Benefits

- **Single Source of Truth**: All type definitions in one place
- **Type Safety**: Ensures consistency across packages
- **Better DX**: Auto-completion and type checking
- **Easy Refactoring**: Change once, update everywhere
