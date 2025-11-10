/**
 * JWT Service - Advanced JWT signing, verification, and key management
 * 
 * Features:
 * - RS256 signature algorithm with RSA keys
 * - JTI-based token revocation
 * - JWKS endpoint support
 * - Token refresh with rotation
 * - Comprehensive error handling
 * - Security best practices
 */

import jwt from 'jsonwebtoken'
import { SignJWT, jwtVerify, importPKCS8, importSPKI, exportJWK } from 'jose'
import crypto from 'crypto'
import config from '../config/index.js'

/**
 * JWT Service Class
 */
export class JWTService {
  constructor() {
    this.privateKey = null
    this.publicKey = null
    this.jwk = null
    this.keyId = config.jwt.keyId
    this.algorithm = config.jwt.algorithm
    this.issuer = config.jwt.issuer
    this.audience = config.jwt.audience
    this.accessTokenTTL = Math.floor(config.jwt.accessTokenTTL / 1000) // Convert to seconds
    this.refreshTokenTTL = Math.floor(config.jwt.refreshTokenTTL / 1000)
    
    this.initialize()
  }
  
  /**
   * Initialize JWT service with keys
   */
  async initialize() {
    try {
      // Import private key for signing
      this.privateKey = await importPKCS8(config.jwt.privateKey, this.algorithm)
      
      // Import public key for verification
      this.publicKey = await importSPKI(config.jwt.publicKey, this.algorithm)
      
      // Export public key as JWK for JWKS endpoint
      this.jwk = await exportJWK(this.publicKey)
      this.jwk.kid = this.keyId
      this.jwk.alg = this.algorithm
      this.jwk.use = 'sig'
      this.jwk.key_ops = ['verify']
      
      console.log('JWT Service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize JWT Service:', error.message)
      throw new Error('JWT Service initialization failed')
    }
  }
  
  /**
   * Generate cryptographically secure JTI
   */
  generateJTI() {
    return crypto.randomUUID()
  }
  
  /**
   * Create access token
   */
  async createAccessToken(payload) {
    try {
      const now = Math.floor(Date.now() / 1000)
      const jti = this.generateJTI()
      
      const tokenPayload = {
        // Standard claims
        iss: this.issuer,
        aud: this.audience,
        sub: payload.userId,
        iat: now,
        exp: now + this.accessTokenTTL,
        jti,

        // Custom claims
        email: payload.email,
        email_verified: payload.emailVerified || false,
        org_id: payload.orgId || null,
        role: payload.role || null,
        permissions: payload.permissions || [],

        // Session context
        session_id: payload.sessionId,
        device_info: payload.deviceInfo || {},

        // Token type
        token_type: 'access',

        // Additional custom claims (for service accounts, OAuth, etc.)
        ...(payload.type && { type: payload.type }),
        ...(payload.clientId && { client_id: payload.clientId }),
        ...(payload.organizationId && { organization_id: payload.organizationId }),
        ...(payload.organizationSlug && { organization_slug: payload.organizationSlug }),
        ...(payload.tenantId && { tenant_id: payload.tenantId }),
        ...(payload.scopes && { scopes: payload.scopes }),
      }
      
      const token = await new SignJWT(tokenPayload)
        .setProtectedHeader({
          alg: this.algorithm,
          kid: this.keyId,
          typ: 'JWT',
        })
        .sign(this.privateKey)
      
      return {
        token,
        jti,
        expiresAt: new Date((now + this.accessTokenTTL) * 1000),
        expiresIn: this.accessTokenTTL,
      }
    } catch (error) {
      console.error('Failed to create access token:', error.message)
      throw new Error('Access token creation failed')
    }
  }
  
  /**
   * Create refresh token
   */
  async createRefreshToken(payload) {
    try {
      const now = Math.floor(Date.now() / 1000)
      const jti = this.generateJTI()
      
      const tokenPayload = {
        // Standard claims
        iss: this.issuer,
        aud: this.audience,
        sub: payload.userId,
        iat: now,
        exp: now + this.refreshTokenTTL,
        jti,
        
        // Minimal claims for refresh token
        session_id: payload.sessionId,
        token_type: 'refresh',
        
        // Link to access token for rotation
        access_jti: payload.accessJTI,
      }
      
      const token = await new SignJWT(tokenPayload)
        .setProtectedHeader({
          alg: this.algorithm,
          kid: this.keyId,
          typ: 'JWT',
        })
        .sign(this.privateKey)
      
      return {
        token,
        jti,
        expiresAt: new Date((now + this.refreshTokenTTL) * 1000),
        expiresIn: this.refreshTokenTTL,
      }
    } catch (error) {
      console.error('Failed to create refresh token:', error.message)
      throw new Error('Refresh token creation failed')
    }
  }
  
  /**
   * Create token pair (access + refresh)
   */
  async createTokenPair(payload) {
    try {
      // Create access token first
      const accessToken = await this.createAccessToken(payload)
      
      // Create refresh token with reference to access token
      const refreshToken = await this.createRefreshToken({
        ...payload,
        accessJTI: accessToken.jti,
      })
      
      return {
        accessToken: {
          token: accessToken.token,
          jti: accessToken.jti,
          expiresAt: accessToken.expiresAt,
          expiresIn: accessToken.expiresIn,
        },
        refreshToken: {
          token: refreshToken.token,
          jti: refreshToken.jti,
          expiresAt: refreshToken.expiresAt,
          expiresIn: refreshToken.expiresIn,
        },
      }
    } catch (error) {
      console.error('Failed to create token pair:', error.message)
      throw new Error('Token pair creation failed')
    }
  }
  
  /**
   * Verify and decode JWT token
   */
  async verifyToken(token, options = {}) {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, this.publicKey, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [this.algorithm],
        ...options,
      })
      
      // Additional security checks
      if (!payload.jti) {
        throw new Error('Token missing JTI claim')
      }
      
      if (!payload.sub) {
        throw new Error('Token missing subject claim')
      }
      
      // Check token type if specified
      if (options.tokenType && payload.token_type !== options.tokenType) {
        throw new Error(`Expected ${options.tokenType} token, got ${payload.token_type}`)
      }
      
      return {
        payload,
        header: protectedHeader,
        jti: payload.jti,
        userId: payload.sub,
        sessionId: payload.session_id,
        tokenType: payload.token_type,
        isExpired: false,
      }
    } catch (error) {
      // Handle specific JWT errors
      if (error.code === 'ERR_JWT_EXPIRED') {
        return {
          payload: null,
          isExpired: true,
          error: 'Token has expired',
        }
      }
      
      if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
        throw new Error('Invalid token signature')
      }
      
      if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
        throw new Error('Token claim validation failed')
      }
      
      console.error('Token verification failed:', error.message)
      throw new Error('Token verification failed')
    }
  }
  
  /**
   * Verify access token
   */
  async verifyAccessToken(token, options = {}) {
    return this.verifyToken(token, {
      ...options,
      tokenType: 'access',
    })
  }
  
  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token, options = {}) {
    return this.verifyToken(token, {
      ...options,
      tokenType: 'refresh',
    })
  }
  
  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true })
    } catch (error) {
      console.error('Failed to decode token:', error.message)
      return null
    }
  }
  
  /**
   * Get token expiration info
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token)
      if (!decoded || !decoded.payload.exp) {
        return null
      }
      
      const expirationDate = new Date(decoded.payload.exp * 1000)
      const now = new Date()
      const isExpired = expirationDate <= now
      const timeToExpiration = expirationDate.getTime() - now.getTime()
      
      return {
        expiresAt: expirationDate,
        isExpired,
        timeToExpiration: Math.max(0, timeToExpiration),
        timeToExpirationSeconds: Math.max(0, Math.floor(timeToExpiration / 1000)),
      }
    } catch (error) {
      console.error('Failed to get token expiration:', error.message)
      return null
    }
  }
  
  /**
   * Check if token needs refresh (within 5 minutes of expiration)
   */
  shouldRefreshToken(token, thresholdMinutes = 5) {
    const expiration = this.getTokenExpiration(token)
    if (!expiration) return true
    
    const thresholdMs = thresholdMinutes * 60 * 1000
    return expiration.timeToExpiration <= thresholdMs
  }
  
  /**
   * Get JWKS (JSON Web Key Set) for public key distribution
   */
  getJWKS() {
    if (!this.jwk) {
      throw new Error('JWT Service not initialized')
    }
    
    return {
      keys: [this.jwk],
    }
  }
  
  /**
   * Get public key in PEM format
   */
  getPublicKeyPEM() {
    return config.jwt.publicKey
  }
  
  /**
   * Validate JWT configuration
   */
  validateConfiguration() {
    const errors = []
    
    if (!config.jwt.privateKey) {
      errors.push('JWT private key is required')
    }
    
    if (!config.jwt.publicKey) {
      errors.push('JWT public key is required')
    }
    
    if (!config.jwt.issuer) {
      errors.push('JWT issuer is required')
    }
    
    if (!['RS256', 'ES256', 'EdDSA'].includes(this.algorithm)) {
      errors.push(`Unsupported JWT algorithm: ${this.algorithm}`)
    }
    
    if (this.accessTokenTTL < 60) { // Less than 1 minute
      errors.push('Access token TTL should be at least 1 minute')
    }
    
    if (this.refreshTokenTTL < 3600) { // Less than 1 hour
      errors.push('Refresh token TTL should be at least 1 hour')
    }
    
    if (errors.length > 0) {
      throw new Error(`JWT configuration validation failed: ${errors.join(', ')}`)
    }
    
    return true
  }
  
  /**
   * Get service health status
   */
  getHealthStatus() {
    try {
      this.validateConfiguration()
      
      return {
        status: 'healthy',
        algorithm: this.algorithm,
        keyId: this.keyId,
        issuer: this.issuer,
        audience: this.audience,
        accessTokenTTL: this.accessTokenTTL,
        refreshTokenTTL: this.refreshTokenTTL,
        initialized: !!this.privateKey && !!this.publicKey,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      }
    }
  }
}

// Create singleton instance
const jwtService = new JWTService()

// Export singleton and class
export default jwtService
