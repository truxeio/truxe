/**
 * OAuth Authorization Service
 *
 * Handles OAuth 2.0 Authorization Code flow:
 * - Authorization request validation
 * - Authorization code generation and storage
 * - PKCE (Proof Key for Code Exchange) support
 * - Code expiration and single-use enforcement
 *
 * Database Tables:
 * - oauth_authorization_codes: Stores authorization codes
 * - oauth_user_consents: Tracks user consent history
 */

import crypto from 'crypto';
import { getPool } from '../../database/connection.js';
import clientService from './client-service.js';
import * as validators from './validators.js';

class OAuthAuthorizationService {

  // ============================================================================
  // AUTHORIZATION REQUEST VALIDATION
  // ============================================================================

  /**
   * Validate authorization request
   *
   * @param {Object} params
   * @param {string} params.clientId - Client ID
   * @param {string} params.redirectUri - Redirect URI
   * @param {string} params.responseType - Response type (must be 'code')
   * @param {string} params.scope - Space-separated scopes
   * @param {string} params.state - State parameter (for CSRF protection)
   * @param {string} params.codeChallengeMethod - PKCE method ('S256' or 'plain')
   * @param {string} params.codeChallenge - PKCE code challenge
   *
   * @returns {Promise<Object>} Validated request with client data
   *
   * @throws {Error} If validation fails
   */
  async validateAuthorizationRequest({
    clientId,
    redirectUri,
    responseType,
    scope,
    state,
    codeChallengeMethod,
    codeChallenge,
  }) {
    // Use shared validators for consistent validation logic
    
    // 1. Validate client exists and is active
    const client = await validators.validateClient(clientId);

    // 2. Validate redirect URI is whitelisted
    await validators.validateRedirectUri(clientId, redirectUri);

    // 3. Validate response_type is 'code'
    validators.validateResponseType(responseType);

    // 4. Validate scopes are allowed for this client
    const requestedScopes = validators.parseScopes(scope);
    
    if (requestedScopes.length === 0) {
      throw new Error('No scopes requested');
    }

    // Validate scope format
    validators.validateScopeFormats(requestedScopes);

    // Check if all requested scopes are in client's allowed_scopes
    const allowedScopes = client.allowed_scopes || [];
    validators.validateScopesAgainstAllowed(requestedScopes, allowedScopes);

    // 5. Validate PKCE if required by client
    validators.validatePKCE(client, codeChallenge, codeChallengeMethod);

    // 6. Validate state parameter exists (CSRF protection)
    validators.validateState(state);

    // 7. Return validated request data
    return {
      client,
      clientId,
      redirectUri,
      responseType,
      scopes: requestedScopes,
      state,
      codeChallenge,
      codeChallengeMethod,
    };
  }

  // ============================================================================
  // AUTHORIZATION CODE GENERATION
  // ============================================================================

  /**
   * Generate authorization code
   *
   * @param {Object} params
   * @param {string} params.clientId - Client ID
   * @param {UUID} params.userId - User ID who authorized
   * @param {string} params.redirectUri - Redirect URI
   * @param {string[]} params.scopes - Array of granted scopes
   * @param {string} params.codeChallenge - PKCE code challenge (optional)
   * @param {string} params.codeChallengeMethod - PKCE method (optional)
   * @param {number} params.expiresIn - Expiration time in seconds (default: 600 = 10 minutes)
   *
   * @returns {Promise<Object>} { code, expires_at }
   *
   * @throws {Error} If generation fails
   */
  async generateAuthorizationCode({
    clientId,
    userId,
    redirectUri,
    scopes,
    codeChallenge = null,
    codeChallengeMethod = null,
    expiresIn = 600, // 10 minutes default
  }) {
    // === DEFENSE-IN-DEPTH VALIDATION ===
    // These validations ensure security even if service is called directly
    // without going through validateAuthorizationRequest()

    // 1. Validate client exists and is active
    const client = await validators.validateClient(clientId);
    
    // 2. Validate redirect URI is whitelisted
    await validators.validateRedirectUri(clientId, redirectUri);
    
    // 3. Validate scopes against client's allowed scopes
    const allowedScopes = client.allowed_scopes || [];
    validators.validateScopesAgainstAllowed(scopes, allowedScopes);
    
    // 4. Validate PKCE if required by client
    validators.validatePKCE(client, codeChallenge, codeChallengeMethod);
    
    // 5. Validate tenant isolation (user and client in same tenant)
    await validators.validateTenantIsolation(userId, client.tenant_id);

    // === CODE GENERATION ===
    
    // 6. Generate secure random code
    const code = this.generateCode();

    // 7. Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 8. Store code in oauth_authorization_codes table
    const pool = getPool();
    
    const query = `
      INSERT INTO oauth_authorization_codes (
        code,
        client_id,
        user_id,
        redirect_uri,
        scope,
        code_challenge,
        code_challenge_method,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING code, expires_at, created_at
    `;

    const values = [
      code,
      clientId,
      userId,
      redirectUri,
      scopes.join(' '), // Convert array to space-separated string
      codeChallenge,
      codeChallengeMethod,
      expiresAt,
    ];

    const result = await pool.query(query, values);

    // 9. Return code and expiration
    return {
      code: result.rows[0].code,
      expires_at: result.rows[0].expires_at,
    };
  }

  /**
   * Generate random authorization code
   *
   * Format: ac_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars after 'ac_')
   *
   * @returns {string} Authorization code
   */
  generateCode() {
    // Use crypto.randomBytes(32) and convert to URL-safe base64
    const randomBytes = crypto.randomBytes(32);
    const randomChars = this.base64URLEncode(randomBytes);
    
    // Format: ac_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    return `ac_${randomChars}`;
  }

  // ============================================================================
  // AUTHORIZATION CODE VALIDATION
  // ============================================================================

  /**
   * Validate and consume authorization code
   *
   * This method:
   * 1. Validates the authorization code exists
   * 2. Checks it hasn't been used
   * 3. Checks it hasn't expired
   * 4. Validates PKCE code_verifier if required
   * 5. Marks code as used (single-use enforcement)
   * 6. Returns authorization data
   *
   * @param {Object} params
   * @param {string} params.code - Authorization code
   * @param {string} params.clientId - Client ID
   * @param {string} params.redirectUri - Redirect URI (must match original)
   * @param {string} params.codeVerifier - PKCE code verifier (optional)
   *
   * @returns {Promise<Object|null>} Authorization data or null if invalid
   *
   * @throws {Error} If validation fails
   */
  async validateAndConsumeCode({
    code,
    clientId,
    redirectUri,
    codeVerifier = null,
  }) {
    const pool = getPool();

    // 1. Fetch code from database
    const query = `
      SELECT id, code, client_id, user_id, redirect_uri, scope,
             code_challenge, code_challenge_method, expires_at, used_at, created_at
      FROM oauth_authorization_codes
      WHERE code = $1
    `;

    const result = await pool.query(query, [code]);

    // 2. Validate code exists
    if (result.rows.length === 0) {
      return null;
    }

    const authCode = result.rows[0];
    
    // Parse scope string to array
    const scopes = this.parseScopes(authCode.scope);

    // 3. Validate not already used
    if (authCode.used_at !== null) {
      return null;
    }

    // 4. Validate not expired
    if (new Date(authCode.expires_at) < new Date()) {
      return null;
    }

    // 5. Validate client_id matches
    if (authCode.client_id !== clientId) {
      return null;
    }

    // 6. Validate redirect_uri matches (exact match, case-sensitive)
    if (authCode.redirect_uri !== redirectUri) {
      return null;
    }

    // 7. Validate PKCE code_verifier if code_challenge exists
    if (authCode.code_challenge) {
      if (!codeVerifier) {
        return null;
      }

      const isValidPKCE = this.validatePKCE(
        codeVerifier,
        authCode.code_challenge,
        authCode.code_challenge_method
      );

      if (!isValidPKCE) {
        return null;
      }
    }

    // 8. Mark code as used (set used_at timestamp)
    const updateQuery = `
      UPDATE oauth_authorization_codes
      SET used_at = NOW()
      WHERE id = $1
    `;

    await pool.query(updateQuery, [authCode.id]);

    // 9. Return authorization data
    return {
      user_id: authCode.user_id,
      scopes: scopes,
      client_id: authCode.client_id,
    };
  }

  /**
   * Validate PKCE code verifier
   *
   * @param {string} codeVerifier - Code verifier from token request
   * @param {string} codeChallenge - Code challenge from authorization request
   * @param {string} codeChallengeMethod - Method ('S256' or 'plain')
   *
   * @returns {boolean} True if valid
   */
  validatePKCE(codeVerifier, codeChallenge, codeChallengeMethod) {
    if (codeChallengeMethod === 'plain') {
      // Plain method: codeChallenge === codeVerifier
      // Use timing-safe comparison to prevent timing attacks
      return this.timingSafeEqual(codeChallenge, codeVerifier);
    } else if (codeChallengeMethod === 'S256') {
      // S256 method: codeChallenge === base64url(sha256(codeVerifier))
      const computedChallenge = this.hashCodeVerifier(codeVerifier);
      
      // Use timing-safe comparison
      return this.timingSafeEqual(codeChallenge, computedChallenge);
    }

    return false;
  }

  // ============================================================================
  // USER CONSENT MANAGEMENT
  // ============================================================================

  /**
   * Check if user has previously consented to client
   *
   * @param {UUID} userId - User ID
   * @param {string} clientId - Client ID
   * @param {string[]} scopes - Requested scopes
   *
   * @returns {Promise<Object|null>} Consent record or null
   */
  async checkUserConsent(userId, clientId, scopes) {
    const pool = getPool();

    // 1. Query oauth_user_consents for userId + clientId
    const query = `
      SELECT id, user_id, client_id, scope, granted_at
      FROM oauth_user_consents
      WHERE user_id = $1 AND client_id = $2
    `;

    const result = await pool.query(query, [userId, clientId]);

    if (result.rows.length === 0) {
      return null;
    }

    const consent = result.rows[0];

    // 2. Check if all requested scopes are in granted scopes
    const grantedScopes = this.parseScopes(consent.scope);
    const allScopesGranted = scopes.every(scope => grantedScopes.includes(scope));

    // 3. Return consent record if valid, null otherwise
    if (allScopesGranted) {
      // Add parsed scopes for convenience
      consent.granted_scopes = grantedScopes;
      return consent;
    }

    return null;
  }

  /**
   * Record user consent
   *
   * @param {Object} params
   * @param {UUID} params.userId - User ID
   * @param {string} params.clientId - Client ID
   * @param {string[]} params.scopes - Granted scopes
   *
   * @returns {Promise<Object>} Consent record
   */
  async recordUserConsent({ userId, clientId, scopes }) {
    const pool = getPool();

    // 1. Insert or update oauth_user_consents
    const query = `
      INSERT INTO oauth_user_consents (user_id, client_id, scope, granted_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, client_id)
      DO UPDATE SET
        scope = EXCLUDED.scope
      RETURNING id, user_id, client_id, scope, granted_at
    `;

    const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;
    const values = [userId, clientId, scopeString];

    const result = await pool.query(query, values);

    // 3. Return consent record with parsed scopes
    const consent = result.rows[0];
    consent.granted_scopes = this.parseScopes(consent.scope);
    return consent;
  }

  /**
   * Revoke user consent
   *
   * @param {UUID} userId - User ID
   * @param {string} clientId - Client ID
   *
   * @returns {Promise<void>}
   */
  async revokeUserConsent(userId, clientId) {
    const pool = getPool();

    // Delete from oauth_user_consents where userId + clientId
    const query = `
      DELETE FROM oauth_user_consents
      WHERE user_id = $1 AND client_id = $2
    `;

    await pool.query(query, [userId, clientId]);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Delete expired authorization codes
   *
   * @returns {Promise<number>} Number of codes deleted
   */
  async cleanupExpiredCodes() {
    const pool = getPool();

    // Delete from oauth_authorization_codes where expires_at < NOW() AND used_at IS NULL
    const query = `
      DELETE FROM oauth_authorization_codes
      WHERE expires_at < NOW() AND used_at IS NULL
    `;

    const result = await pool.query(query);
    
    return result.rowCount;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Parse scopes string into array
   *
   * @param {string} scopesString - Space-separated scopes
   * @returns {string[]} Array of scopes
   */
  parseScopes(scopesString) {
    if (!scopesString || typeof scopesString !== 'string') {
      return [];
    }
    return scopesString.trim().split(/\s+/).filter(Boolean);
  }

  /**
   * Validate scope format
   *
   * @param {string} scope - Single scope
   * @returns {boolean} True if valid
   */
  isValidScope(scope) {
    // Scopes must be alphanumeric, underscore, or colon
    return /^[a-z0-9_:]+$/i.test(scope);
  }

  /**
   * Hash code challenge for S256 method
   *
   * @param {string} codeVerifier - Code verifier
   * @returns {string} Base64URL encoded SHA256 hash
   */
  hashCodeVerifier(codeVerifier) {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    return this.base64URLEncode(hash);
  }

  /**
   * Base64URL encode (URL-safe base64)
   *
   * @param {Buffer} buffer - Buffer to encode
   * @returns {string} Base64URL encoded string
   */
  base64URLEncode(buffer) {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Timing-safe string comparison (prevents timing attacks)
   *
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} True if strings are equal
   */
  timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    // If lengths are different, use dummy comparison to prevent timing leaks
    if (a.length !== b.length) {
      // Compare against itself to maintain constant time
      crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }

    // Use crypto.timingSafeEqual for constant-time comparison
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export default new OAuthAuthorizationService();
