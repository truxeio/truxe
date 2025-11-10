import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/auth/login', async (request, reply) => {
    const { oauthClient } = fastify;
    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = oauthClient.generatePkce();

    request.session.set('oauth_state', state);
    request.session.set('oauth_code_verifier', codeVerifier);

    const authorizationUrl = oauthClient.getAuthorizationUrl(state, codeChallenge);
    reply.redirect(authorizationUrl);
  });

  fastify.get('/auth/callback', async (request, reply) => {
    const { code, state } = request.query as { code: string; state: string };
    const { oauthClient } = fastify;

    const savedState = request.session.get('oauth_state');
    const codeVerifier = request.session.get('oauth_code_verifier');

    if (state !== savedState || !codeVerifier) {
      return reply.code(400).send({ error: 'Invalid state or code verifier' });
    }

    try {
      const tokens = await oauthClient.getTokens(code, codeVerifier);
      request.session.set('access_token', tokens.access_token);
      request.session.set('refresh_token', tokens.refresh_token);
      request.session.set('expires_at', Date.now() + tokens.expires_in * 1000);

      // Clear oauth session data
      request.session.delete('oauth_state');
      request.session.delete('oauth_code_verifier');

      reply.redirect('/dashboard');
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: 'Failed to exchange token' });
    }
  });

  fastify.get('/auth/logout', async (request, reply) => {
    request.session.destroy((err) => {
      if (err) {
        return reply.code(500).send({ error: 'Failed to logout' });
      }
      reply.redirect('/');
    });
  });
};

export default authRoutes;