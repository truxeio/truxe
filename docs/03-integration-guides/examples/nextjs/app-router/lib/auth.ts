'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { oauthClient } from './oauth-client';
import crypto from 'crypto';

export async function login() {
  const state = crypto.randomBytes(16).toString('hex');
  const { codeVerifier, codeChallenge } = oauthClient.generatePkce();

  cookies().set('oauth_state', state, { httpOnly: true, maxAge: 60 * 10 }); // 10 minutes
  cookies().set('oauth_code_verifier', codeVerifier, { httpOnly: true, maxAge: 60 * 10 });

  const authorizationUrl = oauthClient.getAuthorizationUrl(state, codeChallenge);
  redirect(authorizationUrl);
}

export async function logout() {
  cookies().delete('access_token');
  cookies().delete('refresh_token');
  cookies().delete('expires_at');
  redirect('/');
}