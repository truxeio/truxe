/**
 * OAuth validation utilities
 * 
 * Shared validators for OAuth Provider services.
 * Used by both endpoint-level and service-layer validation for defense-in-depth.
 */

import clientService from './client-service.js';
import { getPool } from '../../database/connection.js';

/**
 * Validate client name
 *
 * @param {string} clientName
 * @throws {Error} If invalid
 */
export function validateClientName(clientName) {
  if (!clientName || typeof clientName !== 'string') {
    throw new Error('Client name is required and must be a string');
  }

  if (clientName.length < 1 || clientName.length > 255) {
    throw new Error('Client name must be between 1 and 255 characters');
  }
}

/**
 * Validate client exists and is active
 * 
 * @param {string} clientId - Client ID to validate
 * @returns {Promise<Object>} Client object if valid
 * @throws {Error} If client invalid or inactive
 */
export async function validateClient(clientId) {
  const client = await clientService.getClientById(clientId);
  
  if (!client) {
    throw new Error('Invalid client_id');
  }

  if (client.status !== 'active') {
    throw new Error(`Client is ${client.status}`);
  }

  return client;
}

/**
 * Validate redirect URI is whitelisted for client
 * 
 * @param {string} clientId - Client ID
 * @param {string} redirectUri - Redirect URI to validate
 * @returns {Promise<boolean>} True if valid
 * @throws {Error} If redirect URI not whitelisted
 */
export async function validateRedirectUri(clientId, redirectUri) {
  const isValid = await clientService.validateRedirectUri(clientId, redirectUri);
  
  if (!isValid) {
    throw new Error('Invalid redirect_uri');
  }

  return true;
}

/**
 * Validate redirect URIs
 *
 * @param {string[]} redirectUris
 * @throws {Error} If invalid
 */
export function validateRedirectUris(redirectUris) {
  if (!Array.isArray(redirectUris)) {
    throw new Error('Redirect URIs must be an array');
  }

  if (redirectUris.length === 0) {
    throw new Error('At least one redirect URI is required');
  }

  // Validate each URI
  for (const uri of redirectUris) {
    // Disallow javascript: protocol first (before URL parsing)
    if (uri.toLowerCase().startsWith('javascript:')) {
      throw new Error('JavaScript protocol is not allowed in redirect URIs');
    }

    try {
      const url = new URL(uri);

      // Disallow dangerous protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Invalid protocol in redirect URI: ${uri}`);
      }

    } catch (error) {
      throw new Error(`Invalid redirect URI: ${uri} - ${error.message}`);
    }
  }
}

/**
 * Validate UUID format
 *
 * @param {string} uuid
 * @param {string} fieldName
 * @throws {Error} If invalid
 */
export function validateUUID(uuid, fieldName = 'UUID') {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuid || !uuidRegex.test(uuid)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
}

/**
 * Validate OAuth scopes against client's allowed scopes
 *
 * @param {string[]} scopes - Array of requested scopes
 * @param {string[]} allowedScopes - Array of client's allowed scopes
 * @throws {Error} If invalid
 */
export function validateScopes(scopes) {
  if (!Array.isArray(scopes)) {
    throw new Error('Scopes must be an array');
  }

  const validScopes = ['openid', 'email', 'profile', 'offline_access', 'admin'];

  for (const scope of scopes) {
    if (!validScopes.includes(scope)) {
      throw new Error(`Invalid scope: ${scope}. Valid scopes: ${validScopes.join(', ')}`);
    }
  }
}

/**
 * Validate scopes against client's allowed scopes list
 * 
 * @param {string[]} scopes - Array of requested scopes
 * @param {string[]} allowedScopes - Array of client's allowed scopes
 * @returns {boolean} True if all scopes valid
 * @throws {Error} If any scope not allowed
 */
export function validateScopesAgainstAllowed(scopes, allowedScopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error('Scopes must be a non-empty array');
  }

  // Check if all requested scopes are in client's allowed_scopes
  const invalidScopes = scopes.filter(s => !allowedScopes.includes(s));
  
  if (invalidScopes.length > 0) {
    throw new Error(`Scopes not allowed for this client: ${invalidScopes.join(', ')}`);
  }

  return true;
}

/**
 * Validate scope format (basic validation)
 * 
 * @param {string} scope - Scope string to validate
 * @returns {boolean} True if valid format
 */
export function isValidScopeFormat(scope) {
  // Scope must be lowercase alphanumeric with dots, hyphens, underscores
  return /^[a-z0-9._:-]+$/.test(scope);
}

/**
 * Parse space-separated scope string into array
 * 
 * @param {string} scope - Space-separated scope string
 * @returns {string[]} Array of scopes
 */
export function parseScopes(scope) {
  if (!scope || typeof scope !== 'string') {
    return [];
  }
  return scope.trim().split(/\s+/).filter(s => s.length > 0);
}

/**
 * Validate all scopes have valid format
 * 
 * @param {string[]} scopes - Array of scopes to validate
 * @returns {boolean} True if all valid
 * @throws {Error} If any scope has invalid format
 */
export function validateScopeFormats(scopes) {
  for (const scope of scopes) {
    if (!isValidScopeFormat(scope)) {
      throw new Error(`Invalid scope format: ${scope}`);
    }
  }
  return true;
}

/**
 * Validate PKCE parameters if required by client
 * 
 * @param {Object} client - Client object
 * @param {string|null} codeChallenge - PKCE code challenge
 * @param {string|null} codeChallengeMethod - PKCE method (S256 or plain)
 * @returns {boolean} True if valid
 * @throws {Error} If PKCE validation fails
 */
export function validatePKCE(client, codeChallenge, codeChallengeMethod) {
  if (client.require_pkce) {
    if (!codeChallenge) {
      throw new Error('code_challenge is required for this client');
    }
    if (!codeChallengeMethod) {
      throw new Error('code_challenge_method is required for this client');
    }
    if (codeChallengeMethod !== 'S256' && codeChallengeMethod !== 'plain') {
      throw new Error('code_challenge_method must be "S256" or "plain"');
    }
  }

  return true;
}

/**
 * Validate user belongs to same tenant as client (tenant isolation)
 * 
 * @param {string} userId - User ID
 * @param {string} clientTenantId - Client's tenant ID
 * @returns {Promise<boolean>} True if user in same tenant
 * @throws {Error} If tenant mismatch
 */
export async function validateTenantIsolation(userId, clientTenantId) {
  const pool = getPool();
  
  // Check if user is a member of the client's tenant
  const result = await pool.query(`
    SELECT tenant_id 
    FROM tenant_members 
    WHERE user_id = $1 AND tenant_id = $2
  `, [userId, clientTenantId]);

  if (result.rows.length === 0) {
    throw new Error('User and client must belong to same tenant');
  }

  return true;
}

/**
 * Validate response_type parameter
 * 
 * @param {string} responseType - Response type (must be 'code')
 * @returns {boolean} True if valid
 * @throws {Error} If response_type not 'code'
 */
export function validateResponseType(responseType) {
  if (responseType !== 'code') {
    throw new Error('Invalid response_type. Must be "code"');
  }
  return true;
}

/**
 * Validate state parameter (CSRF protection)
 * 
 * @param {string} state - State parameter
 * @returns {boolean} True if valid
 * @throws {Error} If state missing or empty
 */
export function validateState(state) {
  if (!state || state.trim().length === 0) {
    throw new Error('state parameter is required');
  }
  return true;
}
