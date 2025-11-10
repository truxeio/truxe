import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { OAuthClient } from '../oauth-client';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const oauthClient = new OAuthClient({
    truxeUrl: process.env.TRUXE_URL!,
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    redirectUri: process.env.OAUTH_REDIRECT_URI!,
  });

  fastify.decorate('oauthClient', oauthClient);

  fastify.decorate('authenticate', async function(request, reply) {
    const accessToken = request.session.get('access_token');
    const expiresAt = request.session.get('expires_at');

    if (!accessToken) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (Date.now() >= expiresAt - 300000) {
      const refreshToken = request.session.get('refresh_token');
      if (refreshToken) {
        const tokens = await oauthClient.refreshAccessToken(refreshToken);
        request.session.set('access_token', tokens.access_token);
        request.session.set('expires_at', Date.now() + tokens.expires_in * 1000);
      }
    }
  });
};

export default fp(authPlugin);