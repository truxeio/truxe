/**
 * JWKS (JSON Web Key Set) Routes
 * 
 * Provides public key distribution for JWT verification:
 * - GET /.well-known/jwks.json - JWKS endpoint (RFC 7517)
 * - GET /.well-known/openid-configuration - OpenID Connect Discovery (RFC 8414)
 */

import jwtService from '../services/jwt.js'
import config from '../config/index.js'

/**
 * JWKS routes plugin
 */
export default async function jwksRoutes(fastify, options) {
  // JWKS endpoint (RFC 7517)
  fastify.get('/.well-known/jwks.json', {
    schema: {
      description: 'JSON Web Key Set for JWT verification',
      tags: ['JWKS'],
      response: {
        200: {
          type: 'object',
          properties: {
            keys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kty: { type: 'string', description: 'Key type' },
                  use: { type: 'string', description: 'Key use' },
                  kid: { type: 'string', description: 'Key ID' },
                  alg: { type: 'string', description: 'Algorithm' },
                  n: { type: 'string', description: 'RSA modulus' },
                  e: { type: 'string', description: 'RSA exponent' },
                  key_ops: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Key operations',
                  },
                },
                required: ['kty', 'use', 'kid', 'alg'],
              },
            },
          },
          required: ['keys'],
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const jwks = jwtService.getJWKS()
      
      // Set appropriate caching headers
      reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      reply.header('Content-Type', 'application/json')
      
      return reply.send(jwks)
    } catch (error) {
      fastify.log.error('JWKS endpoint failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve JWKS',
      })
    }
  })
  
  // OpenID Connect Discovery endpoint (RFC 8414)
  fastify.get('/.well-known/openid-configuration', {
    schema: {
      description: 'OpenID Connect Discovery metadata',
      tags: ['JWKS'],
      response: {
        200: {
          type: 'object',
          properties: {
            issuer: { type: 'string' },
            authorization_endpoint: { type: 'string' },
            token_endpoint: { type: 'string' },
            userinfo_endpoint: { type: 'string' },
            jwks_uri: { type: 'string' },
            response_types_supported: {
              type: 'array',
              items: { type: 'string' },
            },
            subject_types_supported: {
              type: 'array',
              items: { type: 'string' },
            },
            id_token_signing_alg_values_supported: {
              type: 'array',
              items: { type: 'string' },
            },
            scopes_supported: {
              type: 'array',
              items: { type: 'string' },
            },
            token_endpoint_auth_methods_supported: {
              type: 'array',
              items: { type: 'string' },
            },
            claims_supported: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const baseUrl = `${request.protocol}://${request.hostname}`
      
      const discoveryDocument = {
        issuer: config.jwt.issuer,
        authorization_endpoint: `${baseUrl}/auth/authorize`,
        token_endpoint: `${baseUrl}/auth/token`,
        userinfo_endpoint: `${baseUrl}/auth/me`,
        jwks_uri: `${baseUrl}/.well-known/jwks.json`,
        
        // Supported response types
        response_types_supported: [
          'code',
          'token',
          'id_token',
          'code token',
          'code id_token',
          'token id_token',
          'code token id_token',
        ],
        
        // Supported subject identifier types
        subject_types_supported: ['public'],
        
        // Supported signing algorithms
        id_token_signing_alg_values_supported: [config.jwt.algorithm],
        
        // Supported scopes
        scopes_supported: [
          'openid',
          'email',
          'profile',
          'offline_access',
        ],
        
        // Supported token endpoint authentication methods
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
          'none',
        ],
        
        // Supported claims
        claims_supported: [
          'iss',
          'sub',
          'aud',
          'exp',
          'iat',
          'auth_time',
          'nonce',
          'email',
          'email_verified',
          'name',
          'given_name',
          'family_name',
          'picture',
        ],
        
        // Additional metadata
        grant_types_supported: [
          'authorization_code',
          'implicit',
          'refresh_token',
        ],
        
        code_challenge_methods_supported: ['S256'],
        
        // Custom Heimdall metadata
        magic_link_endpoint: `${baseUrl}/auth/magic-link`,
        refresh_endpoint: `${baseUrl}/auth/refresh`,
        revocation_endpoint: `${baseUrl}/auth/revoke`,
        
        // Service information
        service_documentation: 'https://docs.truxe.io',
        op_policy_uri: 'https://truxe.io/privacy',
        op_tos_uri: 'https://truxe.io/terms',
      }
      
      // Set appropriate caching headers
      reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      reply.header('Content-Type', 'application/json')
      
      return reply.send(discoveryDocument)
    } catch (error) {
      fastify.log.error('OpenID Connect Discovery failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve OpenID Connect configuration',
      })
    }
  })
  
  // Public key endpoint (PEM format)
  fastify.get('/.well-known/public-key.pem', {
    schema: {
      description: 'Public key in PEM format for JWT verification',
      tags: ['JWKS'],
      response: {
        200: {
          type: 'string',
          description: 'PEM-formatted public key',
        },
      },
    },
  }, async (request, reply) => {
    try {
      const publicKeyPEM = jwtService.getPublicKeyPEM()
      
      // Set appropriate headers
      reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      reply.header('Content-Type', 'application/x-pem-file')
      reply.header('Content-Disposition', 'attachment; filename="truxe-public-key.pem"')
      
      return reply.send(publicKeyPEM)
    } catch (error) {
      fastify.log.error('Public key endpoint failed:', error.message)
      
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve public key',
      })
    }
  })
  
  // Health check for JWKS service
  fastify.get('/.well-known/health', {
    schema: {
      description: 'Health check for JWKS service',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            jwt: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                algorithm: { type: 'string' },
                keyId: { type: 'string' },
                issuer: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const jwtHealth = jwtService.getHealthStatus()
      
      const health = {
        status: jwtHealth.status,
        timestamp: new Date().toISOString(),
        jwt: jwtHealth,
        endpoints: {
          jwks: `${request.protocol}://${request.hostname}/.well-known/jwks.json`,
          openid_configuration: `${request.protocol}://${request.hostname}/.well-known/openid-configuration`,
          public_key: `${request.protocol}://${request.hostname}/.well-known/public-key.pem`,
        },
      }
      
      const statusCode = health.status === 'healthy' ? 200 : 503
      
      return reply.code(statusCode).send(health)
    } catch (error) {
      fastify.log.error('JWKS health check failed:', error.message)
      
      return reply.code(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      })
    }
  })
}
