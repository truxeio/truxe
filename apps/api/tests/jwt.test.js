/**
 * JWT Service Tests
 */

import { describe, test, expect, beforeAll } from '@jest/globals'
import { JWTService } from '../src/services/jwt.js'

describe('JWT Service', () => {
  let jwtService

  beforeAll(async () => {
    jwtService = new JWTService()
    await jwtService.initialize()
  })

  describe('Token Creation', () => {
    test('should create valid access token', async () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        sessionId: 'session-123',
      }

      const result = await jwtService.createAccessToken(payload)

      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('jti')
      expect(result).toHaveProperty('expiresAt')
      expect(result).toHaveProperty('expiresIn')
      expect(typeof result.token).toBe('string')
      expect(typeof result.jti).toBe('string')
    })

    test('should create valid refresh token', async () => {
      const payload = {
        userId: 'user-123',
        sessionId: 'session-123',
        accessJTI: 'access-jti-123',
      }

      const result = await jwtService.createRefreshToken(payload)

      expect(result).toHaveProperty('token')
      expect(result).toHaveProperty('jti')
      expect(result).toHaveProperty('expiresAt')
      expect(result).toHaveProperty('expiresIn')
    })
  })

  describe('Token Verification', () => {
    test('should verify valid access token', async () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        sessionId: 'session-123',
      }

      const tokenResult = await jwtService.createAccessToken(payload)
      const verification = await jwtService.verifyAccessToken(tokenResult.token)

      expect(verification.payload).toBeDefined()
      expect(verification.payload.sub).toBe(payload.userId)
      expect(verification.payload.email).toBe(payload.email)
      expect(verification.jti).toBe(tokenResult.jti)
    })

    test('should reject invalid token', async () => {
      await expect(jwtService.verifyAccessToken('invalid-token')).rejects.toThrow()
    })
  })

  describe('JWKS', () => {
    test('should return valid JWKS', () => {
      const jwks = jwtService.getJWKS()

      expect(jwks).toHaveProperty('keys')
      expect(Array.isArray(jwks.keys)).toBe(true)
      expect(jwks.keys.length).toBeGreaterThan(0)
      expect(jwks.keys[0]).toHaveProperty('kty')
      expect(jwks.keys[0]).toHaveProperty('kid')
      expect(jwks.keys[0]).toHaveProperty('alg')
    })
  })
})
