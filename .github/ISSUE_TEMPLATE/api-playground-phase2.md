# API Playground - Phase 2: Code Generation

## Overview
Implement multi-language code generation feature that converts API requests into executable code snippets. Users can copy generated code directly into their projects, significantly reducing integration time.

## Prerequisites
- ✅ Phase 1 Complete: Core playground with Request Builder
- ✅ Monaco Editor already integrated
- ✅ Request/Response state management working

## Goals
- Generate executable code in 6+ languages from current request
- Real-time updates as request parameters change
- Syntax highlighting for all generated code
- One-click copy to clipboard
- Download as file option
- Include authentication headers automatically

## Scope

### 2.1 Code Generator Library (Week 3, Day 1-2)
**Priority: High**

**File:** `packages/playground/src/lib/code-generator.ts`

#### Core Functions

```typescript
export interface RequestConfig {
  method: string
  url: string
  headers: Record<string, string>
  body?: any
  params?: Record<string, string>
}

export interface GeneratedCode {
  language: string
  code: string
  filename: string
  extension: string
}

export type SupportedLanguage =
  | 'curl'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'php'
  | 'rust'
  | 'java'

class CodeGenerator {
  // Generate code for specific language
  generate(config: RequestConfig, language: SupportedLanguage): GeneratedCode

  // Generate code for all languages
  generateAll(config: RequestConfig): Record<SupportedLanguage, GeneratedCode>
}
```

#### Language-Specific Generators

**1. cURL Generator**
```typescript
function generateCurl(config: RequestConfig): string {
  const { method, url, headers, body, params } = config

  // Build query string
  const queryString = params
    ? '?' + new URLSearchParams(params).toString()
    : ''

  let curl = `curl -X ${method} '${url}${queryString}'`

  // Add headers
  Object.entries(headers).forEach(([key, value]) => {
    curl += ` \\\n  -H '${key}: ${value}'`
  })

  // Add body for POST/PUT/PATCH
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    curl += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`
  }

  return curl
}
```

**Example Output:**
```bash
curl -X POST 'http://localhost:3456/auth/magic-link/send' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGc...' \
  -d '{
  "email": "user@example.com"
}'
```

**2. JavaScript (fetch) Generator**
```typescript
function generateJavaScript(config: RequestConfig): string {
  const { method, url, headers, body, params } = config

  const queryString = params
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const headersCode = JSON.stringify(headers, null, 2)
  const bodyCode = body ? `,\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''

  return `
const response = await fetch('${url}${queryString}', {
  method: '${method}',
  headers: ${headersCode}${bodyCode}
});

if (!response.ok) {
  throw new Error(\`HTTP error! status: \${response.status}\`);
}

const data = await response.json();
console.log(data);
  `.trim()
}
```

**Example Output:**
```javascript
const response = await fetch('http://localhost:3456/auth/magic-link/send', {
  method: 'POST',
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer eyJhbGc..."
  },
  body: JSON.stringify({
    "email": "user@example.com"
  })
});

if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}

const data = await response.json();
console.log(data);
```

**3. TypeScript (typed fetch) Generator**
```typescript
function generateTypeScript(config: RequestConfig): string {
  const { method, url, headers, body, params } = config

  // Infer response type from endpoint (use OpenAPI spec)
  const responseType = 'AuthResponse' // TODO: Get from OpenAPI

  const queryString = params
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const headersCode = JSON.stringify(headers, null, 2)
  const bodyCode = body ? `,\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''

  return `
interface ${responseType} {
  // TODO: Generate from OpenAPI schema
  [key: string]: any;
}

const response = await fetch('${url}${queryString}', {
  method: '${method}',
  headers: ${headersCode}${bodyCode}
});

if (!response.ok) {
  throw new Error(\`HTTP error! status: \${response.status}\`);
}

const data: ${responseType} = await response.json();
console.log(data);
  `.trim()
}
```

**4. Python (requests) Generator**
```typescript
function generatePython(config: RequestConfig): string {
  const { method, url, headers, body, params } = config

  const headersCode = JSON.stringify(headers, null, 2)
    .replace(/"/g, "'")

  const paramsCode = params
    ? `,\n    params=${JSON.stringify(params, null, 2).replace(/"/g, "'")}`
    : ''

  const jsonCode = body
    ? `,\n    json=${JSON.stringify(body, null, 2).replace(/"/g, "'")}`
    : ''

  return `
import requests

response = requests.${method.toLowerCase()}(
    '${url}',
    headers=${headersCode}${paramsCode}${jsonCode}
)

response.raise_for_status()
data = response.json()
print(data)
  `.trim()
}
```

**Example Output:**
```python
import requests

response = requests.post(
    'http://localhost:3456/auth/magic-link/send',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGc...'
    },
    json={
        'email': 'user@example.com'
    }
)

response.raise_for_status()
data = response.json()
print(data)
```

**5. Go (net/http) Generator**
```typescript
function generateGo(config: RequestConfig): string {
  const { method, url, headers, body, params } = config

  const queryString = params
    ? '?' + new URLSearchParams(params).toString()
    : ''

  const bodyCode = body
    ? `
  payload := []byte(\`${JSON.stringify(body, null, 2)}\`)
  req, err := http.NewRequest("${method}", "${url}${queryString}", bytes.NewBuffer(payload))
`
    : `
  req, err := http.NewRequest("${method}", "${url}${queryString}", nil)
`

  const headersCode = Object.entries(headers)
    .map(([key, value]) => `  req.Header.Set("${key}", "${value}")`)
    .join('\n')

  return `
package main

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
)

func main() {
${bodyCode}
  if err != nil {
    panic(err)
  }

${headersCode}

  client := &http.Client{}
  resp, err := client.Do(req)
  if err != nil {
    panic(err)
  }
  defer resp.Body.Close()

  body, err := io.ReadAll(resp.Body)
  if err != nil {
    panic(err)
  }

  var result map[string]interface{}
  json.Unmarshal(body, &result)
  fmt.Printf("%+v\\n", result)
}
  `.trim()
}
```

**6. PHP (cURL) Generator**
```typescript
function generatePHP(config: RequestConfig): string {
  const { method, url, headers, body, params } = config

  const queryString = params
    ? '?' + http_build_query(params)
    : ''

  const headersArray = Object.entries(headers)
    .map(([key, value]) => `    '${key}: ${value}'`)
    .join(',\n')

  const bodyCode = body
    ? `
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(${JSON.stringify(body, null, 2)}));
`
    : ''

  return `
<?php

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, '${url}${queryString}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
${headersArray}
]);
${bodyCode}
$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch);
    exit;
}

curl_close($ch);

$data = json_decode($response, true);
print_r($data);
  `.trim()
}
```

---

### 2.2 UI Component (Week 3, Day 3)
**Priority: High**

**File:** `packages/playground/src/components/CodeGenerator.tsx`

#### Component Structure

```typescript
import { useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/Button'
import { codeGenerator, SupportedLanguage } from '@/lib/code-generator'
import { RequestConfig } from '@/lib/request-executor'

interface CodeGeneratorProps {
  request: RequestConfig
}

export default function CodeGenerator({ request }: CodeGeneratorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('curl')
  const [copied, setCopied] = useState(false)

  const languages: Array<{id: SupportedLanguage, label: string, icon: string}> = [
    { id: 'curl', label: 'cURL', icon: '🔧' },
    { id: 'javascript', label: 'JavaScript', icon: '🟨' },
    { id: 'typescript', label: 'TypeScript', icon: '🔷' },
    { id: 'python', label: 'Python', icon: '🐍' },
    { id: 'go', label: 'Go', icon: '🔵' },
    { id: 'php', label: 'PHP', icon: '🐘' },
  ]

  const generatedCode = codeGenerator.generate(request, selectedLanguage)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([generatedCode.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = generatedCode.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Language selector */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          {languages.map((lang) => (
            <Button
              key={lang.id}
              variant={selectedLanguage === lang.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLanguage(lang.id)}
            >
              <span className="mr-2">{lang.icon}</span>
              {lang.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Code editor */}
      <div className="flex-1">
        <Editor
          language={getMonacoLanguage(selectedLanguage)}
          value={generatedCode.code}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}

function getMonacoLanguage(lang: SupportedLanguage): string {
  const mapping: Record<SupportedLanguage, string> = {
    curl: 'shell',
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    go: 'go',
    php: 'php',
    rust: 'rust',
    java: 'java',
  }
  return mapping[lang]
}
```

---

### 2.3 Integration with RequestBuilder (Week 3, Day 4)
**Priority: High**

**File:** `packages/playground/src/components/RequestBuilder.tsx`

#### Add "Code" Tab

```typescript
// Update activeTab state
const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'params' | 'auth' | 'code'>('body')

// Add Code tab to tabs list
<Tabs.List>
  <Tabs.Tab value="body">Body</Tabs.Tab>
  <Tabs.Tab value="headers">Headers</Tabs.Tab>
  <Tabs.Tab value="params">Params</Tabs.Tab>
  <Tabs.Tab value="auth">Auth</Tabs.Tab>
  <Tabs.Tab value="code">Code</Tabs.Tab> {/* NEW */}
</Tabs.List>

// Add Code tab content
<Tabs.Content value="code">
  <CodeGenerator request={buildRequestConfig()} />
</Tabs.Content>

// Helper to build current request config
function buildRequestConfig(): RequestConfig {
  return {
    method,
    url: environmentManager.getFullUrl(url),
    headers: Object.fromEntries(
      headers.filter(h => h.enabled).map(h => [h.key, h.value])
    ),
    body: method !== 'GET' ? JSON.parse(body) : undefined,
    params: Object.fromEntries(
      params.filter(p => p.enabled).map(p => [p.key, p.value])
    ),
  }
}
```

---

### 2.4 Advanced Features (Week 3, Day 5 - Optional)
**Priority: Medium**

#### Environment Variable Interpolation

```typescript
function interpolateEnvVars(code: string, env: Environment): string {
  return code
    .replace(/\{\{baseUrl\}\}/g, env.baseUrl)
    .replace(/\{\{apiKey\}\}/g, env.apiKey || 'YOUR_API_KEY')
    .replace(/\{\{token\}\}/g, env.jwtToken || 'YOUR_JWT_TOKEN')
}
```

#### Code Formatting Options

```typescript
interface CodeGenerationOptions {
  includeComments?: boolean
  includeErrorHandling?: boolean
  useAsync?: boolean // For JS/TS
  includeTypes?: boolean // For TS
}

function generateJavaScript(
  config: RequestConfig,
  options: CodeGenerationOptions = {}
): string {
  // Apply options...
}
```

#### OpenAPI Schema Integration

```typescript
// Use OpenAPI spec to generate TypeScript interfaces
import { openAPIParser } from '@/lib/openapi-parser'

function generateTypeScriptTypes(endpoint: APIEndpoint): string {
  const requestType = openAPIParser.getRequestSchema(endpoint)
  const responseType = openAPIParser.getResponseSchema(endpoint)

  return `
// Request type
interface ${endpoint.operationId}Request {
  ${generateInterfaceFields(requestType)}
}

// Response type
interface ${endpoint.operationId}Response {
  ${generateInterfaceFields(responseType)}
}
  `.trim()
}
```

---

## Testing Plan

### Unit Tests

**File:** `packages/playground/tests/lib/code-generator.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { codeGenerator } from '@/lib/code-generator'

describe('CodeGenerator', () => {
  const sampleRequest = {
    method: 'POST',
    url: 'http://localhost:3456/auth/login',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: { email: 'test@example.com', password: 'secret' }
  }

  describe('cURL generation', () => {
    it('generates valid cURL command', () => {
      const code = codeGenerator.generate(sampleRequest, 'curl')

      expect(code.code).toContain("curl -X POST")
      expect(code.code).toContain("'http://localhost:3456/auth/login'")
      expect(code.code).toContain("-H 'Content-Type: application/json'")
      expect(code.code).toContain("-H 'Authorization: Bearer test-token'")
      expect(code.code).toContain('"email":"test@example.com"')
    })

    it('handles GET requests without body', () => {
      const getRequest = { ...sampleRequest, method: 'GET', body: undefined }
      const code = codeGenerator.generate(getRequest, 'curl')

      expect(code.code).toContain("curl -X GET")
      expect(code.code).not.toContain('-d')
    })
  })

  describe('JavaScript generation', () => {
    it('generates valid fetch code', () => {
      const code = codeGenerator.generate(sampleRequest, 'javascript')

      expect(code.code).toContain('await fetch(')
      expect(code.code).toContain("method: 'POST'")
      expect(code.code).toContain('body: JSON.stringify(')
      expect(code.code).toContain('if (!response.ok)')
    })
  })

  describe('Python generation', () => {
    it('generates valid requests code', () => {
      const code = codeGenerator.generate(sampleRequest, 'python')

      expect(code.code).toContain('import requests')
      expect(code.code).toContain('requests.post(')
      expect(code.code).toContain('response.raise_for_status()')
    })
  })

  describe('File metadata', () => {
    it('provides correct filename and extension', () => {
      const curlCode = codeGenerator.generate(sampleRequest, 'curl')
      expect(curlCode.filename).toMatch(/\.sh$/)

      const pythonCode = codeGenerator.generate(sampleRequest, 'python')
      expect(pythonCode.filename).toMatch(/\.py$/)
    })
  })
})
```

### Integration Tests

```typescript
describe('CodeGenerator UI Integration', () => {
  it('updates code when request changes', async () => {
    const { getByRole, getByText } = render(<RequestBuilder />)

    // Change method
    await userEvent.selectOptions(getByRole('combobox'), 'POST')

    // Click Code tab
    await userEvent.click(getByText('Code'))

    // Verify code updated
    expect(getByText(/curl -X POST/)).toBeInTheDocument()
  })

  it('copies code to clipboard', async () => {
    const { getByText } = render(<CodeGenerator request={sampleRequest} />)

    await userEvent.click(getByText('Copy'))

    const clipboardText = await navigator.clipboard.readText()
    expect(clipboardText).toContain('curl -X POST')
  })
})
```

---

## Success Metrics

- [ ] All 6+ languages generate syntactically valid code
- [ ] Generated code is executable without modifications
- [ ] Copy to clipboard works 100% of the time
- [ ] Code updates in real-time (<100ms) when request changes
- [ ] Download functionality works for all file types
- [ ] Auth headers are automatically included
- [ ] Environment variables are properly interpolated

---

## Dependencies

### NPM Packages (Already Installed)
- ✅ Monaco Editor (@monaco-editor/react)
- ✅ Lucide React (icons)

### New Dependencies (None Required)
All code generation is custom TypeScript - no external libraries needed.

---

## Timeline

**Day 1-2: Core Library (8-10 hours)**
- Implement code generator class
- Write generators for all 6 languages
- Add proper escaping and formatting
- Unit tests for each generator

**Day 3: UI Component (4-6 hours)**
- Build CodeGenerator component
- Language selector with icons
- Copy/Download functionality
- Monaco Editor integration

**Day 4: Integration (2-3 hours)**
- Add Code tab to RequestBuilder
- Real-time updates
- Testing & bug fixes

**Day 5: Polish (2-3 hours)**
- Advanced features (optional)
- Documentation
- Edge case handling

**Total: 16-22 hours (2-3 days)**

---

## Acceptance Criteria

- [ ] Users can select from 6+ programming languages
- [ ] Code generates correctly for all HTTP methods
- [ ] Headers, body, and query params are properly formatted
- [ ] Authentication headers are included automatically
- [ ] Copy to clipboard works with visual feedback
- [ ] Download saves file with correct extension
- [ ] Syntax highlighting works for all languages
- [ ] Code updates in real-time as request changes
- [ ] No syntax errors in generated code
- [ ] Works with all environment configurations

---

## Future Enhancements (Phase 3+)

- [ ] Rust generator
- [ ] Java generator
- [ ] Swift generator (iOS)
- [ ] Kotlin generator (Android)
- [ ] More detailed TypeScript types from OpenAPI
- [ ] Code formatting preferences (tabs vs spaces)
- [ ] Template customization
- [ ] SDK-specific generators (@truxe/react examples)

---

**Estimated Total Time**: 2-3 days (16-22 hours)
**Priority**: High (Phase 2 roadmap item)
**Complexity**: Medium
**Value**: Very High (significantly improves DX)
