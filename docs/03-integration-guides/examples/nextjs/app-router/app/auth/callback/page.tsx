import { oauthClient } from '@/lib/oauth-client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

export default async function CallbackPage({ searchParams }: { searchParams: { code: string; state: string } }) {
  const { code, state } = searchParams;

  const savedState = cookies().get('oauth_state')?.value;
  const codeVerifier = cookies().get('oauth_code_verifier')?.value;

  if (state !== savedState || !codeVerifier || !code) {
    return (
        <div>
            <h2>Error</h2>
            <p>Invalid state or code verifier. Please try logging in again.</p>
        </div>
    )
  }

  try {
    const tokens = await oauthClient.getTokens(code, codeVerifier);

    cookies().set('access_token', tokens.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    if (tokens.refresh_token) {
      cookies().set('refresh_token', tokens.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    }
    cookies().set('expires_at', (Date.now() + tokens.expires_in * 1000).toString(), { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

    cookies().delete('oauth_state');
    cookies().delete('oauth_code_verifier');

    redirect('/dashboard');
  } catch (error) {
    console.error(error);
    return (
        <div>
            <h2>Error</h2>
            <p>Failed to exchange token. Please try logging in again.</p>
        </div>
    )
  }
}