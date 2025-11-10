/**
 * OAuth Base Provider Interface
 *
 * Abstract base class for OAuth 2.0 provider implementations.
 * All OAuth providers (Google, GitHub, Apple) extend this class.
 *
 * @implements RFC 6749 - OAuth 2.0 Authorization Framework
 * @implements OpenID Connect Core 1.0 (optional)
 */

import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Base OAuth Provider Class
 *
 * Provides common OAuth functionality and enforces provider interface contract.
 */
export class BaseOAuthProvider {
  constructor(providerName, config) {
    if (new.target === BaseOAuthProvider) {
      throw new Error('BaseOAuthProvider cannot be instantiated directly');
    }

    this.providerName = providerName;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.callbackUrl = config.callbackUrl;
    this.authUrl = config.authUrl;
    this.tokenUrl = config.tokenUrl;
    this.userInfoUrl = config.userInfoUrl;
    this.scopes = config.scopes || [];

    // Validate required configuration
    this.validateConfig();
  }

  /**
   * Validate provider configuration
   * @private
   */
  validateConfig() {
    const required = ['clientId', 'clientSecret', 'callbackUrl', 'authUrl', 'tokenUrl'];
    const missing = required.filter(field => !this[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required OAuth config for ${this.providerName}: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Generate cryptographically secure state parameter for CSRF protection
   *
   * @param {Object} metadata - Optional metadata to encode in state
   * @returns {string} Base64 URL-safe encoded state
   */
  generateState(metadata = {}) {
    const stateData = {
      provider: this.providerName,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      ...metadata
    };

    return Buffer.from(JSON.stringify(stateData))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Validate state parameter
   *
   * @param {string} state - State parameter from OAuth callback
   * @param {number} maxAge - Maximum age in milliseconds (default: 10 minutes)
   * @returns {Object} Decoded state data
   * @throws {Error} If state is invalid or expired
   */
  validateState(state, maxAge = 600000) {
    try {
      // Decode base64 URL-safe encoding
      const padding = '='.repeat((4 - (state.length % 4)) % 4);
      const base64 = state.replace(/-/g, '+').replace(/_/g, '/') + padding;
      const decoded = JSON.parse(Buffer.from(base64, 'base64').toString());

      // Validate timestamp
      if (Date.now() - decoded.timestamp > maxAge) {
        throw new Error('State parameter has expired');
      }

      // Validate provider
      if (decoded.provider !== this.providerName) {
        throw new Error('State provider mismatch');
      }

      return decoded;
    } catch (error) {
      logger.error('State validation failed', {
        provider: this.providerName,
        error: error.message
      });
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Build query string from parameters
   * @private
   */
  buildQueryString(params) {
    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Make HTTP request with error handling
   * @private
   */
  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Heimdall-OAuth/1.0',
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('OAuth HTTP request failed', {
          provider: this.providerName,
          url,
          status: response.status,
          body: errorBody
        });

        throw new Error(
          `OAuth request failed: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      logger.error('OAuth request error', {
        provider: this.providerName,
        url,
        error: error.message
      });
      throw error;
    }
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by provider subclasses
  // ============================================================================

  /**
   * Get authorization URL for OAuth flow
   *
   * @param {string} state - CSRF state parameter
   * @param {string} redirectUri - OAuth callback URL
   * @param {Object} options - Additional provider-specific options
   * @returns {Promise<string>} Authorization URL
   * @abstract
   */
  async getAuthorizationUrl(state, redirectUri, options = {}) {
    throw new Error(`${this.providerName} must implement getAuthorizationUrl()`);
  }

  /**
   * Exchange authorization code for access token
   *
   * @param {string} code - Authorization code from callback
   * @param {string} redirectUri - OAuth callback URL (must match authorization)
   * @returns {Promise<Object>} Token response
   * @abstract
   */
  async exchangeCodeForToken(code, redirectUri) {
    throw new Error(`${this.providerName} must implement exchangeCodeForToken()`);
  }

  /**
   * Get user profile information
   *
   * @param {string} accessToken - OAuth access token
   * @returns {Promise<Object>} Normalized user profile
   * @abstract
   */
  async getUserProfile(accessToken) {
    throw new Error(`${this.providerName} must implement getUserProfile()`);
  }

  /**
   * Refresh access token using refresh token
   *
   * @param {string} refreshToken - OAuth refresh token
   * @returns {Promise<Object>} New token response
   * @abstract
   */
  async refreshAccessToken(refreshToken) {
    throw new Error(`${this.providerName} must implement refreshAccessToken()`);
  }

  /**
   * Revoke OAuth token
   *
   * @param {string} token - Token to revoke (access or refresh)
   * @returns {Promise<boolean>} Success status
   * @abstract
   */
  async revokeToken(token) {
    throw new Error(`${this.providerName} must implement revokeToken()`);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Normalize user profile to standard format
   *
   * @param {Object} rawProfile - Provider-specific profile data
   * @returns {Object} Normalized profile
   * @protected
   */
  normalizeProfile(rawProfile) {
    return {
      id: rawProfile.id || rawProfile.sub,
      email: rawProfile.email,
      emailVerified: rawProfile.email_verified || rawProfile.verified_email || false,
      name: rawProfile.name,
      givenName: rawProfile.given_name || rawProfile.first_name,
      familyName: rawProfile.family_name || rawProfile.last_name,
      picture: rawProfile.picture || rawProfile.avatar_url || rawProfile.avatar,
      locale: rawProfile.locale,
      provider: this.providerName,
      raw: rawProfile
    };
  }

  /**
   * Log OAuth event for debugging and monitoring
   * @protected
   */
  logEvent(event, data = {}) {
    logger.info(`OAuth Event: ${event}`, {
      provider: this.providerName,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Get provider display name
   */
  getDisplayName() {
    return this.providerName.charAt(0).toUpperCase() + this.providerName.slice(1);
  }

  /**
   * Check if provider supports feature
   * @param {string} feature - Feature name (e.g., 'refresh', 'revoke')
   */
  supportsFeature(feature) {
    const features = {
      refresh: true,
      revoke: false,
      openid: false
    };
    return features[feature] || false;
  }
}

/**
 * OAuth Provider Factory
 *
 * Creates appropriate provider instance based on provider name
 */
export class OAuthProviderFactory {
  static providers = new Map();

  /**
   * Register OAuth provider
   */
  static register(providerName, ProviderClass) {
    this.providers.set(providerName.toLowerCase(), ProviderClass);
  }

  /**
   * Create provider instance
   */
  static create(providerName, config) {
    const ProviderClass = this.providers.get(providerName.toLowerCase());

    if (!ProviderClass) {
      throw new Error(`Unknown OAuth provider: ${providerName}`);
    }

    return new ProviderClass(config);
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders() {
    return Array.from(this.providers.keys());
  }
}

export default BaseOAuthProvider;
