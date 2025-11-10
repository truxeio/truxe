/**
 * OAuth Provider Routes Index
 * 
 * Exports all OAuth Provider routes as a unified plugin.
 * 
 * Routes:
 * - /clients - Client management
 * - /authorize - Authorization flow
 * - /token - Token operations
 * - /userinfo - OpenID Connect UserInfo
 * - /.well-known/* - Discovery endpoints
 */

import clientRoutes from './clients.js';
import authorizeRoutes from './authorize.js';
import tokenRoutes from './token.js';
import userinfoRoutes from './userinfo.js';

export default async function oauthProviderRoutes(fastify, options) {
  // Register all OAuth Provider routes
  await fastify.register(clientRoutes);
  await fastify.register(authorizeRoutes);
  await fastify.register(tokenRoutes);
  await fastify.register(userinfoRoutes);
}
