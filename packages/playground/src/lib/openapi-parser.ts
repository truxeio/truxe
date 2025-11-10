import yaml from 'js-yaml'

export interface APIEndpoint {
  id: string
  method: string
  path: string
  description: string
  summary: string
  category: string
  parameters?: Array<{
    name: string
    in: string
    required?: boolean
    description?: string
    schema: any
  }>
  requestBody?: {
    required?: boolean
    content: any
  }
  responses: Record<string, any>
  security?: Array<Record<string, any>>
}

export interface OpenAPISpec {
  openapi: string
  info: any
  servers: Array<{
    url: string
    description: string
  }>
  paths: Record<string, any>
  components: any
}

class OpenAPIParser {
  private spec: OpenAPISpec | null = null

  async loadSpec(specContent: string): Promise<void> {
    try {
      this.spec = yaml.load(specContent) as OpenAPISpec
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI spec: ${error}`)
    }
  }

  getEndpoints(): APIEndpoint[] {
    if (!this.spec) {
      throw new Error('OpenAPI spec not loaded')
    }

    const endpoints: APIEndpoint[] = []

    Object.entries(this.spec.paths).forEach(([path, pathItem]) => {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']
      
      methods.forEach(method => {
        if (pathItem[method]) {
          const operation = pathItem[method]
          const tags = operation.tags || ['Uncategorized']
          const category = tags[0] // Use first tag as category
          
          endpoints.push({
            id: `${method}-${path.replace(/[^a-zA-Z0-9]/g, '-')}`,
            method: method.toUpperCase(),
            path,
            description: operation.description || operation.summary || '',
            summary: operation.summary || operation.description || '',
            category,
            parameters: operation.parameters,
            requestBody: operation.requestBody,
            responses: operation.responses,
            security: operation.security
          })
        }
      })
    })

    return endpoints
  }

  getCategories(): string[] {
    const endpoints = this.getEndpoints()
    const categories = new Set<string>()
    
    endpoints.forEach(endpoint => {
      categories.add(endpoint.category)
    })
    
    return Array.from(categories).sort()
  }

  getServers(): Array<{ url: string; description: string }> {
    return this.spec?.servers || []
  }

  getInfo() {
    return this.spec?.info || {}
  }

  getExampleRequest(endpoint: APIEndpoint): any {
    if (!endpoint.requestBody?.content?.['application/json']?.schema) {
      return null
    }

    const schema = endpoint.requestBody.content['application/json'].schema
    return this.generateExampleFromSchema(schema)
  }

  private generateExampleFromSchema(schema: any): any {
    if (!schema) return null

    // If there's an example, use it
    if (schema.example !== undefined) {
      return schema.example
    }

    // Handle different types
    switch (schema.type) {
      case 'object':
        const obj: any = {}
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
            if (propSchema.example !== undefined) {
              obj[key] = propSchema.example
            } else {
              obj[key] = this.generateExampleFromSchema(propSchema)
            }
          })
        }
        return obj

      case 'array':
        if (schema.items) {
          return [this.generateExampleFromSchema(schema.items)]
        }
        return []

      case 'string':
        if (schema.format === 'email') return 'user@example.com'
        if (schema.format === 'uri') return 'https://example.com'
        if (schema.format === 'date-time') return new Date().toISOString()
        if (schema.pattern) return 'example'
        return schema.default || 'string'

      case 'number':
      case 'integer':
        return schema.default || 0

      case 'boolean':
        return schema.default || false

      default:
        return null
    }
  }

  getResponseExample(endpoint: APIEndpoint, statusCode: string = '200'): any {
    const response = endpoint.responses[statusCode]
    if (!response?.content?.['application/json']?.schema) {
      return null
    }

    const schema = response.content['application/json'].schema
    return this.generateExampleFromSchema(schema)
  }
}

// Singleton instance
export const openAPIParser = new OpenAPIParser()

// Load the OpenAPI spec - in a real app, this would be loaded from the server
export const loadOpenAPISpec = async (): Promise<void> => {
  // For now, we'll use the mock endpoints, but this can be replaced with actual spec loading
  const mockSpec = `
openapi: 3.1.0
info:
  title: Truxe Authentication API
  version: 0.4.0
paths:
  /auth/magic-link:
    post:
      tags: [Authentication]
      summary: Send magic link email
      description: Sends a passwordless authentication magic link to the specified email address
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email:
                  type: string
                  format: email
                  example: "user@example.com"
                orgSlug:
                  type: string
                  example: "acme-corp"
              example:
                email: "user@example.com"
                orgSlug: "acme-corp"
  /auth/verify:
    get:
      tags: [Authentication]
      summary: Verify magic link token
      description: Verifies a magic link token and authenticates the user
      parameters:
        - name: token
          in: query
          required: true
          schema:
            type: string
          example: "ml_1234567890abcdef"
  /auth/mfa/setup:
    post:
      tags: [Multi-Factor Authentication]
      summary: Setup TOTP MFA
      description: Initiates TOTP MFA setup by generating a secret key and QR code
      security:
        - bearerAuth: []
  /auth/mfa/verify:
    post:
      tags: [Multi-Factor Authentication]
      summary: Verify MFA token
      description: Verifies a TOTP token during authentication
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [token]
              properties:
                token:
                  type: string
                  example: "123456"
              example:
                token: "123456"
  /auth/oauth/authorize:
    get:
      tags: [OAuth]
      summary: Get OAuth authorization URL
      description: Initiates OAuth flow by returning authorization URL
      parameters:
        - name: provider
          in: query
          required: true
          schema:
            type: string
            enum: [google, github]
          example: "google"
  /auth/me:
    get:
      tags: [Authentication]
      summary: Get current user
      description: Returns the profile of the authenticated user
      security:
        - bearerAuth: []
`
  
  await openAPIParser.loadSpec(mockSpec)
}