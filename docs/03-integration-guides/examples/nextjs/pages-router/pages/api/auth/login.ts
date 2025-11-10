import type { NextApiRequest, NextApiResponse } from 'next';
import { oauthClient } from '@/lib/oauth-client';
import crypto from 'crypto';
import { serialize } from 'cookie';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = oauthClient.generatePkce();

  res.setHeader('Set-Cookie', [
    serialize('oauth_state', state, { httpOnly: true, path: '/', maxAge: 60 * 15 }), // 15 minutes
    serialize('oauth_code_verifier', codeVerifier, { httpOnly: true, path: '/', maxAge: 60 * 15 }),
  ]);

  const authorizationUrl = oauthClient.getAuthorizationUrl(state, codeChallenge);
  res.redirect(authorizationUrl);
}