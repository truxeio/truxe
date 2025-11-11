---
name: 🎮 API Playground - Phase 3: Collections & Workflows
about: Implement request collections, saved requests, and guided authentication workflows
title: '🎮 API Playground - Phase 3: Collections & Workflows'
labels: 'enhancement, api-playground, v0.5'
assignees: ''
---

# 🎮 API Playground - Phase 3: Collections & Workflows

## 📋 Overview

Implement advanced productivity features including request collections, saved requests, and guided authentication workflows to help developers efficiently test and integrate with Truxe APIs.

**Related Issues:**
- ✅ Phase 1 Complete: [#6](https://github.com/truxeio/truxe/issues/6) - Core UI & Request/Response
- ✅ Phase 2 Complete: [#7](https://github.com/truxeio/truxe/issues/7) - Code Generation

**Target:** v0.5.0 Release
**Estimated Time:** 4-5 days
**Priority:** High

---

## 🎯 Goals

1. **Request Collections** - Organize and reuse API requests
2. **Saved Requests** - Persist requests with variables and environments
3. **Guided Workflows** - Step-by-step authentication flows
4. **Variables & Templates** - Dynamic request building with variable substitution
5. **Import/Export** - Share collections with team members

---

## 📦 Features

### 1. Request Collections (2 days)

**Core Functionality:**
- Create, rename, delete collections
- Organize requests in folders/groups
- Drag-and-drop reordering
- Nested folder structure
- Collection metadata (name, description, created date)

**UI Components:**
```typescript
// Collection Manager Panel
interface Collection {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
  requests: SavedRequest[]
  folders: Folder[]
}

interface Folder {
  id: string
  name: string
  parentId?: string
  requests: SavedRequest[]
  folders: Folder[]
}

interface SavedRequest {
  id: string
  name: string
  description?: string
  method: string
  path: string
  headers: Record<string, string>
  body?: any
  params?: Record<string, string>
  variables?: Record<string, string>
  tags: string[]
}
```

**Implementation:**
- `src/components/CollectionManager.tsx` - Main collection UI
- `src/components/CollectionTree.tsx` - Tree view with folders
- `src/components/SavedRequestCard.tsx` - Individual request display
- `src/lib/collection-manager.ts` - Collection state management
- `src/lib/storage.ts` - IndexedDB persistence

**Features:**
- ✅ Create new collection
- ✅ Add requests to collection
- ✅ Organize in folders
- ✅ Search within collections
- ✅ Duplicate requests
- ✅ Bulk operations (move, delete)

---

### 2. Variables & Environment Management (1 day)

**Variable Types:**
- **Collection Variables** - Scoped to a collection
- **Environment Variables** - Global across all requests
- **Request Variables** - Local to a single request
- **Dynamic Variables** - Auto-generated (timestamp, UUID, etc.)

**Variable Syntax:**
```javascript
// In request builder
{{baseUrl}}/auth/login
{{apiKey}}
{{userId}}
{{$timestamp}}    // Dynamic variable
{{$randomEmail}}  // Dynamic variable
{{$uuid}}         // Dynamic variable
```

**Implementation:**
```typescript
interface Variable {
  key: string
  value: string
  type: 'collection' | 'environment' | 'request' | 'dynamic'
  enabled: boolean
}

class VariableResolver {
  resolve(template: string, context: VariableContext): string
  getDynamicVariables(): Record<string, () => string>
  validateTemplate(template: string): ValidationResult
}
```

**Dynamic Variables:**
```typescript
const dynamicVariables = {
  '$timestamp': () => Date.now().toString(),
  '$uuid': () => crypto.randomUUID(),
  '$randomEmail': () => `user_${Math.random().toString(36).substring(7)}@example.com`,
  '$randomInt': () => Math.floor(Math.random() * 1000).toString(),
  '$randomString': () => Math.random().toString(36).substring(7),
}
```

**UI Components:**
- Variable editor panel in RequestBuilder
- Environment variable manager
- Variable autocomplete in input fields
- Variable usage highlighting

---

### 3. Guided Authentication Workflows (1 day)

**Workflow Types:**

#### A. Password Authentication Flow
```yaml
Name: Email + Password Login
Steps:
  1. POST /auth/register
     - Input: email, password
     - Save: userId
  2. POST /auth/verify-email
     - Input: userId, verificationCode
     - Save: accessToken
  3. GET /auth/me
     - Header: Authorization: Bearer {{accessToken}}
     - Verify: user.emailVerified = true
```

#### B. Magic Link Flow
```yaml
Name: Passwordless Magic Link
Steps:
  1. POST /auth/magic-link/request
     - Input: email
     - Save: requestId
  2. GET /auth/magic-link/verify
     - Input: token (from email)
     - Save: accessToken
  3. GET /auth/me
     - Header: Authorization: Bearer {{accessToken}}
```

#### C. OAuth Flow
```yaml
Name: GitHub OAuth Integration
Steps:
  1. GET /oauth/github/authorize
     - Opens browser window
     - Save: authorizationCode
  2. POST /oauth/github/callback
     - Input: code
     - Save: accessToken, refreshToken
  3. GET /auth/me
     - Header: Authorization: Bearer {{accessToken}}
```

#### D. MFA Flow
```yaml
Name: Two-Factor Authentication
Steps:
  1. POST /auth/login
     - Input: email, password
     - Save: sessionToken, mfaRequired
  2. POST /mfa/totp/setup
     - Header: X-Session-Token: {{sessionToken}}
     - Save: secret, qrCode
  3. POST /mfa/totp/verify
     - Input: code (from authenticator app)
     - Save: accessToken
  4. POST /mfa/backup-codes/generate
     - Header: Authorization: Bearer {{accessToken}}
     - Save: backupCodes[]
```

**Implementation:**
```typescript
interface WorkflowStep {
  id: string
  name: string
  description: string
  request: RequestConfig
  expectedResponse: {
    status: number
    schema?: any
  }
  extractVariables?: Record<string, string> // JSONPath expressions
  nextStep?: string | ((response: any) => string)
}

interface Workflow {
  id: string
  name: string
  description: string
  category: 'auth' | 'oauth' | 'mfa' | 'custom'
  steps: WorkflowStep[]
  variables: Variable[]
}

class WorkflowRunner {
  async runWorkflow(workflow: Workflow): Promise<WorkflowResult>
  async runStep(step: WorkflowStep, context: VariableContext): Promise<StepResult>
  extractVariables(response: any, extractors: Record<string, string>): Record<string, any>
}
```

**UI Components:**
- `src/components/WorkflowManager.tsx` - Workflow library
- `src/components/WorkflowRunner.tsx` - Step-by-step execution
- `src/components/WorkflowBuilder.tsx` - Create custom workflows
- `src/lib/workflow-engine.ts` - Execution engine

**Pre-built Workflows:**
- ✅ Password Registration + Verification
- ✅ Magic Link Authentication
- ✅ GitHub OAuth Integration
- ✅ MFA Setup + Verification
- ✅ Session Management (Login → Refresh → Logout)
- ✅ Password Reset Flow
- ✅ Multi-Tenant Setup (Create Org → Add Users → Assign Roles)

---

### 4. Import/Export (0.5 days)

**Export Formats:**
- **Truxe Format** (JSON) - Native format with all metadata
- **Postman Collection** - Import/export compatibility
- **OpenAPI 3.1** - Generate from saved requests
- **cURL Script** - Shell script with all requests

**Implementation:**
```typescript
interface ExportOptions {
  format: 'truxe' | 'postman' | 'openapi' | 'curl'
  includeEnvironments: boolean
  includeVariables: boolean
  includeResponses: boolean
}

class CollectionExporter {
  exportToTruxe(collection: Collection): string
  exportToPostman(collection: Collection): PostmanCollection
  exportToOpenAPI(collection: Collection): OpenAPISpec
  exportToCurl(collection: Collection): string
}

class CollectionImporter {
  importFromTruxe(json: string): Collection
  importFromPostman(collection: PostmanCollection): Collection
  detectFormat(data: string): 'truxe' | 'postman' | 'openapi' | 'unknown'
}
```

**UI:**
- Export button in collection menu
- Import button in CollectionManager
- Drag-and-drop import support
- Format auto-detection

---

### 5. Enhanced Search & Filtering (0.5 days)

**Search Capabilities:**
- Full-text search across requests
- Filter by method (GET, POST, etc.)
- Filter by tag
- Filter by collection
- Filter by response status
- Search history

**Implementation:**
```typescript
interface SearchOptions {
  query: string
  methods?: string[]
  tags?: string[]
  collections?: string[]
  statusCodes?: number[]
}

class RequestSearchEngine {
  search(options: SearchOptions): SavedRequest[]
  buildIndex(requests: SavedRequest[]): void
  getSuggestions(partial: string): string[]
}
```

**UI:**
- Global search bar in header
- Advanced filter panel
- Search results with highlighting
- Recent searches

---

## 🏗️ Architecture

### Data Model

```typescript
// Main State
interface PlaygroundState {
  collections: Collection[]
  environments: Environment[]
  variables: Record<string, Variable>
  workflows: Workflow[]
  activeCollection?: string
  activeEnvironment?: string
  recentRequests: SavedRequest[]
}

// Storage Layer
class PlaygroundStorage {
  // Collections
  saveCollection(collection: Collection): Promise<void>
  loadCollections(): Promise<Collection[]>
  deleteCollection(id: string): Promise<void>

  // Requests
  saveRequest(request: SavedRequest, collectionId: string): Promise<void>
  loadRequests(collectionId: string): Promise<SavedRequest[]>

  // Variables
  saveVariables(variables: Record<string, Variable>): Promise<void>
  loadVariables(): Promise<Record<string, Variable>>

  // Workflows
  saveWorkflow(workflow: Workflow): Promise<void>
  loadWorkflows(): Promise<Workflow[]>

  // Export/Import
  export(options: ExportOptions): Promise<string>
  import(data: string, format: string): Promise<Collection>
}
```

### Component Structure

```
src/
├── components/
│   ├── collections/
│   │   ├── CollectionManager.tsx       # Main collections UI
│   │   ├── CollectionTree.tsx          # Tree view
│   │   ├── CollectionEditor.tsx        # Create/edit collections
│   │   ├── FolderManager.tsx           # Folder operations
│   │   └── SavedRequestCard.tsx        # Request display
│   │
│   ├── variables/
│   │   ├── VariableEditor.tsx          # Edit variables
│   │   ├── VariablePanel.tsx           # Variable management
│   │   └── VariableAutocomplete.tsx    # Input autocomplete
│   │
│   ├── workflows/
│   │   ├── WorkflowManager.tsx         # Workflow library
│   │   ├── WorkflowRunner.tsx          # Step execution
│   │   ├── WorkflowBuilder.tsx         # Create workflows
│   │   └── StepEditor.tsx              # Edit workflow steps
│   │
│   └── search/
│       ├── SearchBar.tsx               # Global search
│       ├── AdvancedFilters.tsx         # Filter panel
│       └── SearchResults.tsx           # Results display
│
├── lib/
│   ├── collection-manager.ts           # Collection state
│   ├── variable-resolver.ts            # Variable substitution
│   ├── workflow-engine.ts              # Workflow execution
│   ├── storage.ts                      # IndexedDB persistence
│   ├── import-export.ts                # Import/export logic
│   └── search-engine.ts                # Full-text search
│
└── data/
    └── workflows/
        ├── auth-password.json          # Pre-built workflows
        ├── auth-magic-link.json
        ├── oauth-github.json
        └── mfa-setup.json
```

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)

```typescript
// collection-manager.test.ts
describe('CollectionManager', () => {
  test('creates new collection')
  test('adds request to collection')
  test('organizes requests in folders')
  test('searches within collections')
  test('duplicates requests')
  test('deletes collection')
})

// variable-resolver.test.ts
describe('VariableResolver', () => {
  test('resolves environment variables')
  test('resolves collection variables')
  test('resolves dynamic variables')
  test('handles nested variables')
  test('validates variable syntax')
})

// workflow-engine.test.ts
describe('WorkflowEngine', () => {
  test('runs complete workflow')
  test('extracts variables from responses')
  test('handles step failures')
  test('supports conditional steps')
  test('validates workflow structure')
})

// import-export.test.ts
describe('ImportExport', () => {
  test('exports to Truxe format')
  test('exports to Postman format')
  test('imports from Postman')
  test('detects import format')
  test('handles invalid imports')
})
```

### Integration Tests

```typescript
describe('Collections E2E', () => {
  test('create collection → add requests → run workflow → export')
  test('import Postman collection → execute requests → verify responses')
  test('use variables in workflow → validate substitution')
})
```

**Test Coverage Target:** 85%+

---

## 📊 Success Metrics

- ✅ Users can create and organize collections
- ✅ Variables work across all request types
- ✅ Guided workflows reduce setup time by 80%
- ✅ Import/export maintains 100% fidelity
- ✅ Search returns results in <100ms
- ✅ All pre-built workflows execute successfully

---

## 📝 Implementation Plan

### Day 1-2: Collections & Folders
- [x] Design data model
- [ ] Implement CollectionManager component
- [ ] Build CollectionTree with drag-and-drop
- [ ] Add IndexedDB persistence
- [ ] Create SavedRequestCard
- [ ] Add folder operations (create, rename, delete)
- [ ] Implement search within collections

### Day 3: Variables & Templates
- [ ] Build VariableResolver class
- [ ] Implement variable editor UI
- [ ] Add autocomplete for variables
- [ ] Support dynamic variables
- [ ] Test variable substitution in requests

### Day 4: Guided Workflows
- [ ] Design workflow engine
- [ ] Implement WorkflowRunner component
- [ ] Create 7 pre-built workflows
- [ ] Add step-by-step execution UI
- [ ] Build workflow builder for custom flows
- [ ] Test all authentication workflows

### Day 5: Import/Export & Polish
- [ ] Implement export to Truxe/Postman/OpenAPI
- [ ] Build import from Postman
- [ ] Add drag-and-drop import
- [ ] Implement global search
- [ ] Add advanced filters
- [ ] Write comprehensive tests
- [ ] Update documentation

---

## 🎨 UI/UX Enhancements

### Collection Manager Panel (Left Sidebar)

```
┌─────────────────────────────────────┐
│  Collections            [+] [↓]     │
├─────────────────────────────────────┤
│  🔍 Search collections...           │
├─────────────────────────────────────┤
│  📁 Authentication Flows            │
│    ├─ 📝 Password Login             │
│    ├─ 📝 Magic Link                 │
│    └─ 📁 OAuth                      │
│         ├─ 📝 GitHub OAuth          │
│         └─ 📝 Google OAuth          │
│                                     │
│  📁 User Management                 │
│    ├─ 📝 Create User                │
│    ├─ 📝 Update Profile             │
│    └─ 📝 Delete User                │
│                                     │
│  🎯 Guided Workflows                │
│    ├─ ▶️  Password Flow             │
│    ├─ ▶️  MFA Setup                 │
│    └─ ▶️  Multi-Tenant Setup        │
└─────────────────────────────────────┘
```

### Workflow Runner

```
┌─────────────────────────────────────────────┐
│  🎯 Workflow: Password Registration Flow   │
├─────────────────────────────────────────────┤
│                                             │
│  Step 1 of 3: Register User                │
│  ─────────────────────────────────────      │
│  POST /auth/register                        │
│  ✓ Request sent                             │
│  ✓ Response: 201 Created                    │
│  ✓ Extracted: userId = "abc123"             │
│                                             │
│  Step 2 of 3: Verify Email                 │
│  ─────────────────────────────────────      │
│  POST /auth/verify-email                    │
│  ⏳ Running...                               │
│                                             │
│  Step 3 of 3: Fetch User Profile           │
│  ─────────────────────────────────          │
│  GET /auth/me                               │
│  ⏸️  Waiting...                              │
│                                             │
│  [Continue] [Pause] [Cancel]                │
└─────────────────────────────────────────────┘
```

---

## 📚 Documentation

### User Guide
- How to create collections
- Using variables effectively
- Running guided workflows
- Importing Postman collections
- Creating custom workflows

### Developer Guide
- Collection data model
- Workflow engine API
- Variable resolution logic
- Storage layer architecture
- Testing workflows

---

## 🚀 Future Enhancements (Post-Phase 3)

- **Collaboration**: Share collections with team members
- **Cloud Sync**: Sync collections across devices
- **Mock Servers**: Generate mock responses from saved requests
- **Performance Testing**: Run collections with K6 integration
- **GraphQL Support**: Add GraphQL query builder
- **WebSocket Testing**: Test real-time endpoints
- **Request Chaining**: Auto-chain requests based on responses
- **AI-Powered Suggestions**: Generate workflows from OpenAPI specs

---

## 📎 Related Files

**New Files:**
- `packages/playground/src/components/collections/CollectionManager.tsx`
- `packages/playground/src/components/workflows/WorkflowRunner.tsx`
- `packages/playground/src/lib/collection-manager.ts`
- `packages/playground/src/lib/workflow-engine.ts`
- `packages/playground/src/lib/storage.ts`
- `packages/playground/src/lib/import-export.ts`

**Modified Files:**
- `packages/playground/src/App.tsx` - Add collection panel
- `packages/playground/src/components/EndpointNavigator.tsx` - Integrate collections
- `packages/playground/src/components/RequestBuilder.tsx` - Variable support
- `packages/playground/README.md` - Update docs

---

## ✅ Acceptance Criteria

- [ ] Users can create, rename, and delete collections
- [ ] Requests can be organized in nested folders
- [ ] Variables work in all request fields (URL, headers, body)
- [ ] Dynamic variables generate correctly ($timestamp, $uuid, etc.)
- [ ] All 7 pre-built workflows execute successfully
- [ ] Export to Truxe/Postman formats works
- [ ] Import from Postman collections works
- [ ] Search returns relevant results in <100ms
- [ ] 85%+ test coverage
- [ ] Zero TypeScript errors
- [ ] Documentation is complete and accurate

---

## 🎯 Phase 3 Completion Marks v0.5.0 Release!

After Phase 3, the Truxe API Playground will be feature-complete for the v0.5 release with:
- ✅ Interactive API testing (Phase 1)
- ✅ Code generation in 8 languages (Phase 2)
- ✅ Collections, workflows, and advanced productivity (Phase 3)

**Next Steps After v0.5.0:**
- v0.6: Cloud Launch (Q1 2026)
- v1.0: Enterprise Features (Q2 2026)
