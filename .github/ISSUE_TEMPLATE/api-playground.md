# Interactive API Playground Implementation

## Overview
Build an interactive API playground that allows developers to test Truxe authentication endpoints without writing code. Similar to Swagger UI or Postman, but customized for Truxe's authentication flows.

## Goals
- Enable developers to test all API endpoints interactively
- Provide real-time request/response visualization
- Auto-generate code snippets in multiple languages
- Support authentication flows (OAuth, MFA, magic links)
- Integrate with existing documentation

## Scope

### Phase 1: Core Playground (Week 1-2)
**Priority: High**

#### 1.1 Playground UI Foundation
- [ ] Create new package `@truxe/playground` in monorepo
- [ ] Set up React + TypeScript + Vite
- [ ] Design responsive layout with:
  - Left sidebar: Endpoint navigator
  - Center: Request builder
  - Right: Response viewer
- [ ] Implement dark/light theme toggle
- [ ] Add URL-based state persistence

#### 1.2 Request Builder
- [ ] HTTP method selector (GET, POST, PUT, DELETE, PATCH)
- [ ] Endpoint selector with search/filter
- [ ] Headers editor (key-value pairs)
- [ ] Body editor with:
  - JSON mode (syntax highlighting)
  - Form mode (key-value)
  - Raw mode
- [ ] Query parameters builder
- [ ] Authentication helper:
  - API key input
  - JWT token input
  - OAuth flow trigger

#### 1.3 Response Viewer
- [ ] Status code display with color coding
- [ ] Response headers viewer
- [ ] Response body with:
  - JSON pretty-print
  - Syntax highlighting
  - Copy to clipboard
- [ ] Response time measurement
- [ ] Response size display

#### 1.4 API Endpoint Configuration
- [ ] Create OpenAPI/Swagger spec for all Truxe endpoints:
  ```yaml
  # api/docs/openapi.yaml
  openapi: 3.0.0
  info:
    title: Truxe Authentication API
    version: 0.4.0
  paths:
    /auth/magic-link/send:
      post:
        summary: Send magic link email
        requestBody:
          content:
            application/json:
              schema:
                type: object
                properties:
                  email:
                    type: string
                    format: email
  ```
- [ ] Auto-generate TypeScript types from OpenAPI spec
- [ ] Categorize endpoints:
  - Authentication (magic link, password, OAuth)
  - MFA (TOTP, backup codes)
  - Session management
  - User management
  - Organization/RBAC
  - Webhooks
  - Admin

### Phase 2: Advanced Features (Week 3)
**Priority: Medium**

#### 2.1 Code Generation
- [ ] Generate request code snippets in:
  - cURL
  - JavaScript (fetch)
  - TypeScript (fetch)
  - Python (requests)
  - Go (net/http)
  - PHP (cURL)
- [ ] Include authentication headers automatically
- [ ] One-click copy functionality
- [ ] Download as file option

#### 2.2 Collections & Saved Requests
- [ ] Create request collection system
- [ ] Save requests to localStorage
- [ ] Export/import collections (JSON)
- [ ] Pre-built example collections:
  - "Complete OAuth Flow"
  - "MFA Setup & Verification"
  - "Magic Link Authentication"
  - "RBAC Configuration"

#### 2.3 Environment Variables
- [ ] Environment selector (Local, Staging, Production, Custom)
- [ ] Variable management UI
- [ ] Default environments:
  ```json
  {
    "local": {
      "baseUrl": "http://localhost:3456",
      "apiKey": ""
    },
    "staging": {
      "baseUrl": "https://staging-api.truxe.io",
      "apiKey": ""
    },
    "production": {
      "baseUrl": "https://api.truxe.io",
      "apiKey": ""
    }
  }
  ```
- [ ] Variable interpolation in requests: `{{baseUrl}}/auth/login`

### Phase 3: Integration & Documentation (Week 4)
**Priority: High**

#### 3.1 Documentation Integration
- [ ] Embed playground in existing docs site
- [ ] Add "Try it" buttons in API reference docs
- [ ] Deep link to specific endpoints
- [ ] Sync documentation with OpenAPI spec

#### 3.2 Guided Workflows
- [ ] Create step-by-step authentication flows:
  1. **Magic Link Flow**:
     - Step 1: Send magic link → `/auth/magic-link/send`
     - Step 2: Verify token → `/auth/magic-link/verify`
     - Step 3: Get session → `/auth/session`
  2. **OAuth Flow**:
     - Step 1: Get authorization URL → `/auth/oauth/authorize`
     - Step 2: Exchange code for tokens → `/auth/oauth/token`
     - Step 3: Get user profile → `/auth/me`
  3. **MFA Setup**:
     - Step 1: Generate TOTP secret → `/auth/mfa/totp/setup`
     - Step 2: Verify TOTP code → `/auth/mfa/totp/verify`
     - Step 3: Generate backup codes → `/auth/mfa/backup-codes`

- [ ] Highlight current step
- [ ] Auto-fill next step with previous response data
- [ ] Show progress indicator

#### 3.3 Testing Features
- [ ] Add assertions/tests for responses:
  - Status code checks
  - Response body validation
  - Performance benchmarks
- [ ] Save test suites
- [ ] Run test suites with one click
- [ ] Export test results

### Phase 4: Polish & Deployment (Week 4-5)
**Priority: Medium**

#### 4.1 UX Improvements
- [ ] Keyboard shortcuts:
  - `Cmd/Ctrl + Enter`: Send request
  - `Cmd/Ctrl + K`: Quick search endpoints
  - `Cmd/Ctrl + S`: Save request
- [ ] Request history (last 50 requests)
- [ ] Loading states and animations
- [ ] Error handling with helpful messages
- [ ] Onboarding tour for first-time users

#### 4.2 Deployment
- [ ] Deploy to `playground.truxe.io`
- [ ] Add to main README
- [ ] Create demo video/GIF
- [ ] Add analytics (privacy-friendly)

## Technical Stack

### Frontend
```json
{
  "framework": "React 18 + TypeScript",
  "build": "Vite",
  "styling": "Tailwind CSS",
  "ui-components": "Radix UI",
  "code-editor": "Monaco Editor (VSCode)",
  "syntax-highlighting": "Prism.js",
  "http-client": "axios",
  "state": "zustand",
  "routing": "react-router-dom"
}
```

### Package Structure
```
packages/playground/
├── src/
│   ├── components/
│   │   ├── RequestBuilder/
│   │   ├── ResponseViewer/
│   │   ├── EndpointNavigator/
│   │   ├── CodeGenerator/
│   │   └── WorkflowGuide/
│   ├── lib/
│   │   ├── openapi-parser.ts
│   │   ├── code-generator.ts
│   │   ├── request-executor.ts
│   │   └── environment-manager.ts
│   ├── hooks/
│   │   ├── useRequest.ts
│   │   ├── useEnvironment.ts
│   │   └── useCollection.ts
│   ├── types/
│   │   └── openapi.ts
│   └── App.tsx
├── public/
│   └── collections/
│       ├── oauth-flow.json
│       ├── mfa-setup.json
│       └── magic-link.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## API Specification

### OpenAPI Spec Location
```
api/docs/openapi.yaml  # Main spec
api/docs/schemas/      # Reusable schemas
```

### Generate TypeScript Types
```bash
# Using openapi-typescript
pnpm add -D openapi-typescript
pnpm openapi-typescript api/docs/openapi.yaml -o packages/playground/src/types/api.ts
```

## Example: Request Builder Component

```typescript
// packages/playground/src/components/RequestBuilder/index.tsx
import { useState } from 'react';
import { Monaco } from '@monaco-editor/react';
import { useRequest } from '@/hooks/useRequest';
import { Select, Button, Tabs } from '@/components/ui';

export function RequestBuilder({ endpoint }: { endpoint: APIEndpoint }) {
  const [method, setMethod] = useState(endpoint.defaultMethod);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [body, setBody] = useState('{}');
  const { execute, loading, response } = useRequest();

  const handleSend = async () => {
    await execute({
      method,
      url: endpoint.path,
      headers,
      body: JSON.parse(body),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-4 border-b">
        <Select value={method} onChange={setMethod}>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </Select>

        <input
          type="text"
          value={endpoint.path}
          className="flex-1 px-3 py-2 border rounded"
          readOnly
        />

        <Button onClick={handleSend} loading={loading}>
          Send
        </Button>
      </div>

      <Tabs>
        <Tabs.List>
          <Tabs.Tab value="body">Body</Tabs.Tab>
          <Tabs.Tab value="headers">Headers</Tabs.Tab>
          <Tabs.Tab value="params">Params</Tabs.Tab>
        </Tabs.List>

        <Tabs.Content value="body">
          <Monaco
            language="json"
            value={body}
            onChange={(value) => setBody(value || '{}')}
            theme="vs-dark"
          />
        </Tabs.Content>

        <Tabs.Content value="headers">
          <HeadersEditor value={headers} onChange={setHeaders} />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
```

## Example: Code Generator

```typescript
// packages/playground/src/lib/code-generator.ts
export interface RequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

export function generateCurl(config: RequestConfig): string {
  const { method, url, headers, body } = config;

  let curl = `curl -X ${method} '${url}'`;

  Object.entries(headers).forEach(([key, value]) => {
    curl += ` \\\n  -H '${key}: ${value}'`;
  });

  if (body) {
    curl += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
  }

  return curl;
}

export function generateJavaScript(config: RequestConfig): string {
  const { method, url, headers, body } = config;

  return `
const response = await fetch('${url}', {
  method: '${method}',
  headers: ${JSON.stringify(headers, null, 2)},
  ${body ? `body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''}
});

const data = await response.json();
console.log(data);
  `.trim();
}

export function generatePython(config: RequestConfig): string {
  const { method, url, headers, body } = config;

  return `
import requests

response = requests.${method.toLowerCase()}(
    '${url}',
    headers=${JSON.stringify(headers, null, 2)},
    ${body ? `json=${JSON.stringify(body, null, 2)}` : ''}
)

print(response.json())
  `.trim();
}
```

## Success Metrics

### User Engagement
- [ ] 1,000+ playground sessions in first month
- [ ] Average session duration: 5+ minutes
- [ ] 50+ saved collections created

### Developer Experience
- [ ] Reduce "time to first API call" from 30min → 2min
- [ ] 80%+ satisfaction score in feedback
- [ ] <100ms request execution overhead

### Documentation
- [ ] All 50+ endpoints documented with examples
- [ ] "Try it" button click rate: >30%
- [ ] Reduction in API-related support issues: 40%

## Testing Plan

### Unit Tests
```typescript
// packages/playground/tests/code-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateCurl, generateJavaScript } from '../src/lib/code-generator';

describe('Code Generator', () => {
  it('generates valid cURL command', () => {
    const config = {
      method: 'POST',
      url: 'http://localhost:3456/auth/login',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'test@example.com', password: 'secret' }
    };

    const curl = generateCurl(config);

    expect(curl).toContain("curl -X POST 'http://localhost:3456/auth/login'");
    expect(curl).toContain("-H 'Content-Type: application/json'");
    expect(curl).toContain('-d \'{"email":"test@example.com"');
  });
});
```

### Integration Tests
- [ ] Test all endpoint examples execute successfully
- [ ] Verify code snippets are syntactically valid
- [ ] Test environment variable interpolation
- [ ] Validate OpenAPI spec parsing

### E2E Tests (Playwright)
```typescript
// packages/playground/tests/e2e/oauth-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Complete OAuth flow', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Select OAuth workflow
  await page.click('text=OAuth Flow');

  // Step 1: Get authorization URL
  await page.click('button:has-text("Send")');
  await expect(page.locator('.response-status')).toContainText('200');

  // Step 2: Exchange code
  await page.click('button:has-text("Next Step")');
  await page.click('button:has-text("Send")');
  await expect(page.locator('.response-body')).toContainText('access_token');
});
```

## Timeline

### Week 1: Foundation
- Day 1-2: Project setup, UI skeleton
- Day 3-4: Request builder & response viewer
- Day 5: OpenAPI spec creation

### Week 2: Core Features
- Day 6-7: Endpoint navigation & filtering
- Day 8-9: Authentication helpers
- Day 10: Testing & bug fixes

### Week 3: Advanced Features
- Day 11-12: Code generation
- Day 13-14: Collections & environments
- Day 15: Saved requests & history

### Week 4: Integration
- Day 16-17: Documentation integration
- Day 18-19: Guided workflows
- Day 20: Polish & UX improvements

### Week 5: Launch
- Day 21-22: Deployment & monitoring
- Day 23-24: Demo creation & marketing
- Day 25: Launch & announcement

## Dependencies

### Required
- ✅ OpenAPI 3.0 specification for all endpoints
- ✅ Existing authentication flows working
- ⏳ Documentation site infrastructure

### Optional
- Analytics integration (PostHog, Plausible)
- Video recording capability for demos
- AI-powered example generation

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| OpenAPI spec maintenance overhead | Medium | High | Auto-generate from route definitions |
| Complex OAuth flows hard to simulate | High | Medium | Use iframe for real OAuth redirects |
| Monaco Editor bundle size | Low | High | Code-split and lazy load |
| CORS issues with production API | Medium | Medium | Add CORS proxy option |

## References

### Inspiration
- [Stripe API Playground](https://stripe.com/docs/api)
- [Postman](https://postman.com)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [RapidAPI Testing](https://rapidapi.com/hub)
- [Hoppscotch](https://hoppscotch.io/)

### Technical Docs
- [OpenAPI 3.0 Spec](https://swagger.io/specification/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Radix UI](https://www.radix-ui.com/)

## Acceptance Criteria

- [ ] All Truxe API endpoints are accessible via playground
- [ ] Users can execute requests and see responses in <500ms
- [ ] Code snippets generated in 6+ languages
- [ ] Guided workflows for 3+ authentication methods
- [ ] Deployed to playground.truxe.io with <3s load time
- [ ] Mobile responsive (works on tablets)
- [ ] Keyboard accessible (WCAG 2.1 AA)
- [ ] 90+ Lighthouse score
- [ ] Zero runtime errors in production (first week)

## Questions for Discussion

1. Should we support GraphQL playground as well (future)?
2. Include admin endpoints in playground or separate admin playground?
3. Self-hosted version vs cloud-only?
4. Should saved collections be shareable via URL?
5. Real-time collaboration features (like Figma)?

---

**Estimated Total Time**: 4-5 weeks (1 developer)
**Priority**: High (v0.4 roadmap item)
**Complexity**: Medium-High
**Value**: High (significantly improves DX)
