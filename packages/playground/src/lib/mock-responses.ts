/**
 * Mock API Responses for Demo Mode
 *
 * Enables the playground to work standalone without requiring a live backend.
 * Following best practices from Stripe, Twilio, and Postman playgrounds.
 */

export interface MockResponse {
  status: number
  statusText?: string
  headers?: Record<string, string>
  data: any
  delay?: number // Simulated network delay in ms
}

export interface MockResponseMap {
  [key: string]: MockResponse
}

/**
 * Generate mock responses for common API endpoints
 */
export const mockResponses: MockResponseMap = {
  // Health Check
  'GET /health': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      status: 'ok',
      timestamp: Date.now(),
      version: '0.5.0',
      uptime: 3600,
      mode: 'demo'
    },
    delay: 100
  },

  // Authentication - Login
  'POST /auth/login': {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': 'session=demo_session_abc123; HttpOnly; Secure'
    },
    data: {
      success: true,
      accessToken: 'demo_access_token_eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
      refreshToken: 'demo_refresh_token_xyz789',
      expiresIn: 900,
      user: {
        id: 'demo_user_1',
        email: 'demo@example.com',
        emailVerified: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z'
      }
    },
    delay: 300
  },

  // Authentication - Magic Link Request
  'POST /auth/magic-link': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'Magic link sent to your email',
      expiresIn: 900
    },
    delay: 500
  },

  // Authentication - Me (Current User)
  'GET /auth/me': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      id: 'demo_user_1',
      email: 'demo@example.com',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      profile: {
        name: 'Demo User',
        avatar: null
      }
    },
    delay: 150
  },

  // Authentication - Logout
  'POST /auth/logout': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'Successfully logged out'
    },
    delay: 200
  },

  // Authentication - Refresh Token
  'POST /auth/refresh': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      accessToken: 'demo_new_access_token_abc456',
      refreshToken: 'demo_new_refresh_token_def789',
      expiresIn: 900
    },
    delay: 200
  },

  // MFA - Generate Secret
  'POST /auth/mfa/generate': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      secret: 'DEMO5ECRET234567ABCDEFGHIJK',
      qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      backupCodes: [
        'DEMO-1111-2222',
        'DEMO-3333-4444',
        'DEMO-5555-6666',
        'DEMO-7777-8888',
        'DEMO-9999-0000'
      ]
    },
    delay: 300
  },

  // MFA - Verify Code
  'POST /auth/mfa/verify': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'MFA enabled successfully'
    },
    delay: 200
  },

  // Email Verification - Send
  'POST /auth/email/send-verification': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'Verification email sent'
    },
    delay: 400
  },

  // Email Verification - Verify
  'POST /auth/email/verify': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'Email verified successfully',
      user: {
        id: 'demo_user_1',
        email: 'demo@example.com',
        emailVerified: true
      }
    },
    delay: 300
  },

  // Sessions - List
  'GET /auth/sessions': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      sessions: [
        {
          id: 'session_1',
          deviceInfo: {
            browser: 'Chrome',
            os: 'macOS',
            device: 'Desktop'
          },
          ip: '192.168.1.1',
          current: true,
          lastActive: new Date().toISOString(),
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'session_2',
          deviceInfo: {
            browser: 'Safari',
            os: 'iOS',
            device: 'Mobile'
          },
          ip: '192.168.1.2',
          current: false,
          lastActive: new Date(Date.now() - 172800000).toISOString(),
          createdAt: new Date(Date.now() - 259200000).toISOString()
        }
      ]
    },
    delay: 150
  },

  // Sessions - Revoke
  'DELETE /auth/sessions/:id': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'Session revoked successfully'
    },
    delay: 200
  },

  // Generic Success Response
  'POST /api/*': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      success: true,
      message: 'Request successful (demo mode)',
      timestamp: Date.now()
    },
    delay: 200
  },

  // Generic GET Response
  'GET /api/*': {
    status: 200,
    headers: { 'content-type': 'application/json' },
    data: {
      items: [],
      total: 0,
      page: 1,
      message: 'No data in demo mode'
    },
    delay: 150
  }
}

/**
 * Find matching mock response for a request
 */
export function findMockResponse(method: string, url: string): MockResponse | null {
  // Normalize URL (remove query params and base URL)
  const normalizedUrl = url.split('?')[0]
  const path = normalizedUrl.replace(/^https?:\/\/[^/]+/, '')

  // Try exact match first
  const exactKey = `${method.toUpperCase()} ${path}`
  if (mockResponses[exactKey]) {
    return mockResponses[exactKey]
  }

  // Try wildcard matches (e.g., "POST /api/*")
  for (const [key, response] of Object.entries(mockResponses)) {
    const [mockMethod, mockPath] = key.split(' ')

    if (mockMethod === method.toUpperCase()) {
      // Handle path parameters (e.g., /sessions/:id)
      const mockPathPattern = mockPath.replace(/:[^/]+/g, '[^/]+')
      const pathRegex = new RegExp(`^${mockPathPattern.replace(/\*/g, '.*')}$`)

      if (pathRegex.test(path)) {
        return response
      }
    }
  }

  return null
}

/**
 * Check if demo mode is enabled for an environment
 */
export function isDemoMode(baseUrl: string): boolean {
  return baseUrl.includes('demo') || baseUrl.includes('mock')
}

/**
 * Generate mock error response
 */
export function mockErrorResponse(status: number = 500, message: string = 'Internal Server Error'): MockResponse {
  return {
    status,
    statusText: message,
    headers: { 'content-type': 'application/json' },
    data: {
      error: true,
      message,
      timestamp: Date.now(),
      mode: 'demo'
    },
    delay: 100
  }
}
