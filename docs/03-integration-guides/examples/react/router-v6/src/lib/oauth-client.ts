import axios from 'axios';
import crypto from 'crypto';

interface OAuthClientConfig {
  heimdallUrl: string;
  clientId: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class OAuthClient {
  private config: OAuthClientConfig;

  constructor(config: OAuthClientConfig) {
    this.config = config;
  }

  public getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${this.config.heimdallUrl}/oauth/authorize?${params.toString()}`;
  }

  public async getTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
    });

    const { data } = await axios.post<TokenResponse>(
      `${this.config.heimdallUrl}/oauth/token`,
      params,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    return data;
  }

  public async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
    });

    const { data } = await axios.post<TokenResponse>(
        `${this.config.heimdallUrl}/oauth/token`,
        params,
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
    );
    return data;
  }

  public generatePkce(): { codeVerifier: string; codeChallenge: string } {
    // This should be done on the server-side in a real app, but for simplicity we do it here.
    // In a real SPA, you would have a backend-for-frontend (BFF) that handles this.
    // Or you would store the verifier in a secure, http-only cookie if your setup allows.
    // For this example, we'll use localStorage, but be aware of the security implications.
    const codeVerifier = this.base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = this.base64URLEncode(crypto.createHash('sha256').update(codeVerifier).digest());
    return { codeVerifier, codeChallenge };
  }

  private base64URLEncode(buffer: Buffer): string {
    return buffer.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

export const oauthClient = new OAuthClient({
    heimdallUrl: import.meta.env.VITE_TRUXE_URL,
    clientId: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
});