import type { NextApiRequest, NextApiResponse } from 'next';
import { oauthClient } from '@/lib/oauth-client';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;
  const { oauth_state, oauth_code_verifier } = req.cookies;

  if (typeof state !== 'string' || state !== oauth_state || !oauth_code_verifier || typeof code !== 'string') {
    return res.status(400).send('Invalid state or code verifier');
  }

  try {
    const tokens = await oauthClient.getTokens(code, oauth_code_verifier);

    const cookiesToSet = [
      serialize('access_token', tokens.access_token, { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }),
      serialize('expires_at', (Date.now() + tokens.expires_in * 1000).toString(), { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }),
      // Clear state and verifier
      serialize('oauth_state', '', { httpOnly: true, path: '/', maxAge: -1 }),
      serialize('oauth_code_verifier', '', { httpOnly: true, path: '/', maxAge: -1 }),
    ];

    if (tokens.refresh_token) {
      cookiesToSet.push(serialize('refresh_token', tokens.refresh_token, { httpOnly: true, path: '/', secure: process.env.NODE_ENV === 'production' }));
    }

    res.setHeader('Set-Cookie', cookiesToSet);
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to exchange token');
  }
}