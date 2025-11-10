/**
 * OAuth Token Service
 *
 * Handles OAuth 2.0 token operations:
 * - Access token generation (JWT with RS256)
 * - Refresh token generation and rotation
 * - Token introspection (RFC 7662)
 * - Token revocation (RFC 7009)
 * - UserInfo endpoint (OpenID Connect)
 * - Token validation
 *
 * Security Features:
 * - RS256 asymmetric signing
 * - Refresh token rotation (old token revoked)
 * - JTI (JWT ID) tracking for revocation
 * - Short-lived access tokens (1 hour)
 * - Long-lived refresh tokens (30 days)
 * - Scope validation
 *
 * Database Tables:
 * - oauth_provider_tokens: Stores token metadata and refresh tokens
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getPool } from '../../database/connection.js';
import clientService from './client-service.js';

class OAuthTokenService {

  // ============================================================================
  // TOKEN GENERATION
  // ============================================================================

  /**
   * Generate token pair (access token + refresh token)
   *
   * @param {Object} params
   * @param {string} params.clientId - Client ID
   * @param {string} params.userId - User ID
   * @param {string} params.scope - Space-separated scopes
   * @param {Object} params.userInfo - User information for JWT claims
   *
   * @returns {Promise<Object>} Token response
   *   {
   *     access_token: string,
   *     token_type: 'Bearer',
   *     expires_in: number,
   *     refresh_token: string,
   *     scope: string
   *   }
   */
  async generateTokenPair({ clientId, userId, scope, userInfo }) {
    // 1. Validate client exists and is active
    const client = await clientService.getClientById(clientId);
    
    if (!client) {
      throw new Error('Invalid client_id');
    }

    if (client.status !== 'active') {
      throw new Error(`Client is ${client.status}`);
    }

    // 2. Generate JTI (JWT ID) for tracking/revocation
    const jti = this.generateJti();

    // 3. Generate access token (JWT)
    const accessToken = await this.generateAccessToken({
      clientId,
      userId,
      scope,
      userInfo,
      jti,
    });

    // 4. Generate refresh token
    const refreshToken = this.generateRefreshToken();

    // 5. Calculate expiration times
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + 3600 * 1000); // 1 hour
    const refreshTokenExpiresAt = new Date(now.getTime() + 2592000 * 1000); // 30 days

    // 6. Store token metadata in database
    await this.storeTokenMetadata({
      jti,
      refreshToken,
      clientId,
      userId,
      scope,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    });

    // 7. Return token response (RFC 6749 section 5.1)
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600, // seconds
      refresh_token: refreshToken,
      scope,
    };
  }

  /**
   * Generate JWT access token
   *
   * Uses RS256 asymmetric signing with private key.
   * Token is self-contained with all user information.
   *
   * @param {Object} params
   * @param {string} params.clientId - Client ID
   * @param {string} params.userId - User ID
   * @param {string} params.scope - Space-separated scopes
   * @param {Object} params.userInfo - User information
   * @param {string} params.jti - JWT ID
   *
   * @returns {Promise<string>} JWT access token
   */
  async generateAccessToken({ clientId, userId, scope, userInfo, jti }) {
    // Get JWT configuration from environment
    const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const issuer = process.env.JWT_ISSUER || 'https://auth.truxe.io';
    const kid = process.env.JWT_KID || 'truxe-rsa-2025';

    if (!privateKey) {
      throw new Error('JWT_PRIVATE_KEY not configured');
    }

    // Build JWT payload
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      // Standard claims (RFC 7519)
      iss: issuer,                    // Issuer
      sub: userId,                    // Subject (user ID)
      aud: clientId,                  // Audience (client ID)
      exp: now + 3600,                // Expiration (1 hour)
      iat: now,                       // Issued at
      jti,                            // JWT ID
      
      // OAuth claims
      scope,                          // Granted scopes
      client_id: clientId,            // Client ID
      
      // User claims (based on scope)
      ...this.buildUserClaims(scope, userInfo),
    };

    // Sign JWT with RS256
    const token = jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      keyid: kid,
    });

    return token;
  }

  /**
   * Build user claims based on requested scopes
   *
   * @param {string} scope - Space-separated scopes
   * @param {Object} userInfo - User information
   *
   * @returns {Object} User claims
   */
  buildUserClaims(scope, userInfo) {
    const scopes = scope.split(' ');
    const claims = {};

    // OpenID Connect Core 1.0 - Standard Claims
    if (scopes.includes('openid')) {
      // Sub is already in main payload
    }

    if (scopes.includes('email')) {
      claims.email = userInfo.email;
      claims.email_verified = userInfo.email_verified || false;
    }

    if (scopes.includes('profile')) {
      if (userInfo.name) claims.name = userInfo.name;
      if (userInfo.given_name) claims.given_name = userInfo.given_name;
      if (userInfo.family_name) claims.family_name = userInfo.family_name;
      if (userInfo.picture) claims.picture = userInfo.picture;
      if (userInfo.updated_at) claims.updated_at = userInfo.updated_at;
    }

    return claims;
  }

  /**
   * Generate refresh token
   *
   * Format: rt_ + 43 URL-safe base64 characters
   * Total length: 46 characters
   *
   * @returns {string} Refresh token
   */
  generateRefreshToken() {
    // Generate 32 random bytes (256 bits)
    const randomBytes = crypto.randomBytes(32);
    
    // Convert to URL-safe base64 (43 characters)
    const randomChars = this.base64URLEncode(randomBytes);
    
    // Format: rt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    return `rt_${randomChars}`;
  }

  /**
   * Generate JTI (JWT ID)
   *
   * Unique identifier for JWT access token.
   * Used for token revocation via blacklist.
   *
   * @returns {string} JTI
   */
  generateJti() {
    // UUID v4
    return crypto.randomUUID();
  }

  /**
   * Store token metadata in database
   *
   * @param {Object} params
   * @param {string} params.jti - JWT ID
   * @param {string} params.refreshToken - Refresh token
   * @param {string} params.clientId - Client ID
   * @param {string} params.userId - User ID
   * @param {string} params.scope - Space-separated scopes
   * @param {Date} params.accessTokenExpiresAt - Access token expiration
   * @param {Date} params.refreshTokenExpiresAt - Refresh token expiration
   *
   * @returns {Promise<void>}
   */
  async storeTokenMetadata({
    jti,
    refreshToken,
    clientId,
    userId,
    scope,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  }) {
    const pool = getPool();

    // Hash tokens before storing (never store plaintext)
    const jtiHash = this.hashToken(jti);
    const refreshTokenHash = this.hashToken(refreshToken);

    const query = `
      INSERT INTO oauth_provider_tokens (
        token_hash,
        refresh_token_hash,
        client_id,
        user_id,
        scope,
        expires_at,
        refresh_token_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const values = [
      jtiHash,
      refreshTokenHash,
      clientId,
      userId,
      scope,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    ];

    await pool.query(query, values);
  }

  // ============================================================================
  // REFRESH TOKEN FLOW
  // ============================================================================

  /**
   * Refresh token (with automatic rotation)
   *
   * Issues new token pair and revokes old refresh token.
   * Implements refresh token rotation security best practice.
   *
   * @param {Object} params
   * @param {string} params.refreshToken - Current refresh token
   * @param {string} params.clientId - Client ID
   * @param {string} params.scope - Requested scopes (optional, must be subset)
   *
   * @returns {Promise<Object>} New token response
   *
   * @throws {Error} If refresh token is invalid, expired, or revoked
   */
  async refreshToken({ refreshToken, clientId, scope }) {
    // 1. Validate refresh token format
    if (!refreshToken || !refreshToken.startsWith('rt_')) {
      throw new Error('Invalid refresh token format');
    }

    // 2. Lookup refresh token in database
    const tokenData = await this.getTokenByRefreshToken(refreshToken);

    if (!tokenData) {
      throw new Error('Invalid refresh token');
    }

    // 3. Validate token is not expired
    if (new Date() > new Date(tokenData.refresh_token_expires_at)) {
      throw new Error('Refresh token expired');
    }

    // 4. Validate token is not revoked
    if (tokenData.revoked_at) {
      throw new Error('Refresh token revoked');
    }

    // 5. Validate client_id matches
    if (tokenData.client_id !== clientId) {
      throw new Error('Client ID mismatch');
    }

    // 6. Validate scope (if provided, must be subset of original)
    let finalScope = tokenData.scope;
    
    if (scope) {
      const requestedScopes = scope.split(' ');
      const originalScopes = tokenData.scope.split(' ');
      
      const invalidScopes = requestedScopes.filter(s => !originalScopes.includes(s));
      
      if (invalidScopes.length > 0) {
        throw new Error(`Cannot expand scope. Invalid scopes: ${invalidScopes.join(', ')}`);
      }
      
      finalScope = scope;
    }

    // 7. Get user info for new JWT
    const userInfo = await this.getUserInfo(tokenData.user_id);

    // 8. Revoke old refresh token (rotation)
    await this.revokeRefreshToken(refreshToken);

    // 9. Generate new token pair
    const newTokenPair = await this.generateTokenPair({
      clientId: tokenData.client_id,
      userId: tokenData.user_id,
      scope: finalScope,
      userInfo,
    });

    return newTokenPair;
  }

  /**
   * Get token metadata by refresh token
   *
   * @param {string} refreshToken - Refresh token
   *
   * @returns {Promise<Object|null>} Token metadata
   */
  async getTokenByRefreshToken(refreshToken) {
    const pool = getPool();
    const refreshTokenHash = this.hashToken(refreshToken);

    const query = `
      SELECT 
        id,
        token_hash,
        refresh_token_hash,
        client_id,
        user_id,
        scope,
        expires_at,
        refresh_token_expires_at,
        revoked_at,
        created_at
      FROM oauth_provider_tokens
      WHERE refresh_token_hash = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [refreshTokenHash]);

    return result.rows[0] || null;
  }

  /**
   * Get token metadata by JTI
   *
   * @param {string} jti - JWT ID
   *
   * @returns {Promise<Object|null>} Token metadata
   */
  async getTokenByJti(jti) {
    const pool = getPool();
    const jtiHash = this.hashToken(jti);

    const query = `
      SELECT 
        id,
        token_hash,
        refresh_token_hash,
        client_id,
        user_id,
        scope,
        expires_at,
        refresh_token_expires_at,
        revoked_at,
        created_at
      FROM oauth_provider_tokens
      WHERE token_hash = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [jtiHash]);

    return result.rows[0] || null;
  }

  // ============================================================================
  // TOKEN INTROSPECTION (RFC 7662)
  // ============================================================================

  /**
   * Introspect token
   *
   * Returns token metadata and active status.
   * Requires client authentication.
   *
   * @param {Object} params
   * @param {string} params.token - Token to introspect (access or refresh)
   * @param {string} params.clientId - Client ID (authenticated)
   * @param {string} params.tokenTypeHint - 'access_token' or 'refresh_token'
   *
   * @returns {Promise<Object>} Introspection response
   *   {
   *     active: boolean,
   *     scope: string,
   *     client_id: string,
   *     username: string,
   *     token_type: string,
   *     exp: number,
   *     iat: number,
   *     sub: string
   *   }
   */
  async introspectToken({ token, clientId, tokenTypeHint }) {
    // Default inactive response
    const inactiveResponse = { active: false };

    try {
      // Try to determine token type
      let tokenData;

      if (tokenTypeHint === 'refresh_token' || token.startsWith('rt_')) {
        // Refresh token introspection
        tokenData = await this.getTokenByRefreshToken(token);
      } else {
        // Access token introspection (JWT)
        const decoded = await this.verifyAccessToken(token);
        tokenData = await this.getTokenByJti(decoded.jti);
      }

      if (!tokenData) {
        return inactiveResponse;
      }

      // Check if token is expired
      const now = new Date();
      const expiresAt = tokenTypeHint === 'refresh_token' 
        ? tokenData.refresh_token_expires_at 
        : tokenData.expires_at;

      if (now > new Date(expiresAt)) {
        return inactiveResponse;
      }

      // Check if token is revoked
      if (tokenData.revoked_at) {
        return inactiveResponse;
      }

      // Validate client has permission to introspect
      // (in production, enforce stricter access control)
      if (tokenData.client_id !== clientId) {
        // Optional: allow introspection of tokens issued to different clients
        // For now, we'll allow it but log a warning
        console.warn(`Client ${clientId} introspecting token for client ${tokenData.client_id}`);
      }

      // Build active response
      return {
        active: true,
        scope: tokenData.scope,
        client_id: tokenData.client_id,
        username: tokenData.user_id, // or fetch actual username
        token_type: 'Bearer',
        exp: Math.floor(new Date(expiresAt).getTime() / 1000),
        iat: Math.floor(new Date(tokenData.created_at).getTime() / 1000),
        sub: tokenData.user_id,
      };

    } catch (error) {
      // Any error means token is inactive
      console.error('Token introspection error:', error.message);
      return inactiveResponse;
    }
  }

  // ============================================================================
  // TOKEN REVOCATION (RFC 7009)
  // ============================================================================

  /**
   * Revoke token
   *
   * Supports both access tokens (JWT) and refresh tokens.
   * Operation is idempotent (safe to call multiple times).
   *
   * @param {Object} params
   * @param {string} params.token - Token to revoke
   * @param {string} params.clientId - Client ID (authenticated)
   * @param {string} params.tokenTypeHint - 'access_token' or 'refresh_token'
   *
   * @returns {Promise<void>}
   */
  async revokeToken({ token, clientId, tokenTypeHint }) {
    try {
      // Try to determine token type
      if (tokenTypeHint === 'refresh_token' || token.startsWith('rt_')) {
        // Revoke refresh token
        await this.revokeRefreshToken(token);
      } else {
        // Revoke access token (JWT)
        const decoded = await this.verifyAccessToken(token);
        await this.revokeAccessToken(decoded.jti);
      }
    } catch (error) {
      // RFC 7009: "The client MUST NOT use the token again after revocation."
      // Idempotent: if token is already invalid, return success
      console.log('Token revocation - token already invalid:', error.message);
    }
  }

  /**
   * Revoke access token by JTI
   *
   * @param {string} jti - JWT ID
   *
   * @returns {Promise<void>}
   */
  async revokeAccessToken(jti) {
    const pool = getPool();
    const jtiHash = this.hashToken(jti);

    const query = `
      UPDATE oauth_provider_tokens
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL
    `;

    await pool.query(query, [jtiHash]);
  }

  /**
   * Revoke refresh token
   *
   * @param {string} refreshToken - Refresh token
   *
   * @returns {Promise<void>}
   */
  async revokeRefreshToken(refreshToken) {
    const pool = getPool();
    const refreshTokenHash = this.hashToken(refreshToken);

    const query = `
      UPDATE oauth_provider_tokens
      SET revoked_at = NOW()
      WHERE refresh_token_hash = $1
        AND revoked_at IS NULL
    `;

    await pool.query(query, [refreshTokenHash]);
  }

  // ============================================================================
  // TOKEN VALIDATION
  // ============================================================================

  /**
   * Verify and decode JWT access token
   *
   * Validates:
   * - JWT signature (RS256)
   * - Expiration
   * - Revocation status
   *
   * @param {string} token - JWT access token
   *
   * @returns {Promise<Object>} Decoded token payload
   *
   * @throws {Error} If token is invalid
   */
  async verifyAccessToken(token) {
    // Get JWT public key from environment
    const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');

    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY not configured');
    }

    try {
      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
      });

      // Check if token is revoked (via JTI blacklist)
      const tokenData = await this.getTokenByJti(decoded.jti);

      if (tokenData && tokenData.revoked_at) {
        throw new Error('Token has been revoked');
      }

      return decoded;

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature');
      } else {
        throw error;
      }
    }
  }

  /**
   * Validate token and extract user ID
   *
   * Convenience method for protected routes.
   *
   * @param {string} token - JWT access token
   *
   * @returns {Promise<string>} User ID
   *
   * @throws {Error} If token is invalid
   */
  async validateTokenAndGetUserId(token) {
    const decoded = await this.verifyAccessToken(token);
    return decoded.sub;
  }

  // ============================================================================
  // USERINFO ENDPOINT (OpenID Connect)
  // ============================================================================

  /**
   * Get user info based on access token
   *
   * Returns claims based on granted scopes.
   * Implements OpenID Connect UserInfo endpoint.
   *
   * @param {string} accessToken - JWT access token
   *
   * @returns {Promise<Object>} UserInfo response
   *   {
   *     sub: string,
   *     email?: string,
   *     email_verified?: boolean,
   *     name?: string,
   *     picture?: string,
   *     updated_at?: number
   *   }
   *
   * @throws {Error} If token is invalid
   */
  async getUserInfoByToken(accessToken) {
    // Verify and decode token
    const decoded = await this.verifyAccessToken(accessToken);

    // Get scopes from token
    const scopes = decoded.scope.split(' ');

    // Build UserInfo response based on scopes
    const userInfo = {
      sub: decoded.sub,
    };

    if (scopes.includes('email')) {
      userInfo.email = decoded.email;
      userInfo.email_verified = decoded.email_verified || false;
    }

    if (scopes.includes('profile')) {
      if (decoded.name) userInfo.name = decoded.name;
      if (decoded.given_name) userInfo.given_name = decoded.given_name;
      if (decoded.family_name) userInfo.family_name = decoded.family_name;
      if (decoded.picture) userInfo.picture = decoded.picture;
      if (decoded.updated_at) userInfo.updated_at = decoded.updated_at;
    }

    return userInfo;
  }

  /**
   * Get user info from database
   *
   * @param {string} userId - User ID
   *
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(userId) {
    const pool = getPool();

    const query = `
      SELECT 
        id,
        email,
        email_verified,
        metadata,
        updated_at
      FROM users
      WHERE id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];
    const metadata = user.metadata || {};

    return {
      email: user.email,
      email_verified: user.email_verified || false,
      name: metadata.name || '',
      given_name: metadata.given_name || '',
      family_name: metadata.family_name || '',
      picture: metadata.picture || metadata.avatar_url || null,
      updated_at: Math.floor(new Date(user.updated_at).getTime() / 1000),
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Delete expired tokens
   *
   * Removes tokens where both access and refresh tokens are expired.
   * Should be run periodically via cron job.
   *
   * @returns {Promise<number>} Number of deleted tokens
   */
  async deleteExpiredTokens() {
    const pool = getPool();

    const query = `
      DELETE FROM oauth_provider_tokens
      WHERE expires_at < NOW()
        AND refresh_token_expires_at < NOW()
      RETURNING id
    `;

    const result = await pool.query(query);

    return result.rowCount;
  }

  /**
   * Delete revoked tokens older than 30 days
   *
   * Keep revoked tokens for audit purposes, but clean up old ones.
   *
   * @returns {Promise<number>} Number of deleted tokens
   */
  async deleteOldRevokedTokens() {
    const pool = getPool();

    const query = `
      DELETE FROM oauth_provider_tokens
      WHERE revoked_at IS NOT NULL
        AND revoked_at < NOW() - INTERVAL '30 days'
      RETURNING id
    `;

    const result = await pool.query(query);

    return result.rowCount;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Hash token using SHA-256
   *
   * Never store plaintext tokens in database.
   *
   * @param {string} token - Token to hash
   *
   * @returns {string} SHA-256 hash (hex)
   */
  hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * Base64 URL encode
   *
   * @param {Buffer} buffer - Buffer to encode
   *
   * @returns {string} URL-safe base64 string
   */
  base64URLEncode(buffer) {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL decode
   *
   * @param {string} str - URL-safe base64 string
   *
   * @returns {Buffer} Decoded buffer
   */
  base64URLDecode(str) {
    // Add padding back
    const padding = 4 - (str.length % 4);
    const padded = str + '='.repeat(padding === 4 ? 0 : padding);

    // Replace URL-safe characters
    const base64 = padded
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    return Buffer.from(base64, 'base64');
  }
}

// Export singleton instance
export default new OAuthTokenService();
