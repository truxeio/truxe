import axios from 'axios';
import crypto from 'crypto';

interface OAuthClientConfig {
  heimdallUrl: string;
  clientId: string;
  clientSecret: string;
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
      client_secret: this.config.clientSecret,
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
      client_secret: this.config.clientSecret,
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
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }
}

export const oauthClient = new OAuthClient({
    heimdallUrl: process.env.TRUXE_URL!,
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    redirectUri: process.env.OAUTH_REDIRECT_URI!,
});