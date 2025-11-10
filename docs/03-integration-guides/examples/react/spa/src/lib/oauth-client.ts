/**
 * OAuth Client for Heimdall (Browser/SPA)
 *
 * Implements OAuth 2.0 Authorization Code Flow with PKCE
 * - PKCE (Proof Key for Code Exchange) for security
 * - In-memory token storage (most secure)
 * - Automatic token refresh
 * - State parameter for CSRF protection
 */

export interface OAuthConfig {
  heimdallUrl: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

export interface OAuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export interface UserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  updated_at?: number;
}

export class HeimdallOAuthClient {
  private config: OAuthConfig;
  private tokens: OAuthTokens | null = null;
  private tokenExpiresAt: number | null = null;

  constructor(config: OAuthConfig) {
    this.config = {
      ...config,
      scopes: config.scopes || ['openid', 'profile', 'email']
    };
  }

  /**
   * Initiate OAuth authorization flow
   * Redirects user to Heimdall authorization page
   */
  login(): void {
    const { url, state, codeVerifier } = this.generateAuthorizationUrl();

    // Store state and verifier for validation
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('code_verifier', codeVerifier);

    // Redirect to authorization URL
    window.location.href = url;
  }

  /**
   * Handle OAuth callback
   * Call this on your callback page
   */
  async handleCallback(): Promise<UserInfo> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // Handle authorization errors
    if (error) {
      throw new Error(errorDescription || error);
    }

    // Validate required parameters
    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Validate state (CSRF protection)
    const expectedState = sessionStorage.getItem('oauth_state');
    if (state !== expectedState) {
      throw new Error('Invalid state parameter - potential CSRF attack');
    }

    // Get code verifier
    const codeVerifier = sessionStorage.getItem('code_verifier');
    if (!codeVerifier) {
      throw new Error('Missing code verifier');
    }

    // Clear stored values
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('code_verifier');

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForToken(code, codeVerifier);
    this.setTokens(tokens);

    // Fetch and return user info
    const user = await this.getUserInfo();
    return user;
  }

  /**
   * Get current user info
   */
  async getUserInfo(): Promise<UserInfo> {
    const accessToken = await this.getValidAccessToken();

    const response = await fetch(`${this.config.heimdallUrl}/oauth-provider/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  /**
   * Logout
   * Revokes tokens and clears local state
   */
  async logout(): Promise<void> {
    if (this.tokens?.access_token) {
      try {
        await this.revokeToken(this.tokens.access_token);
      } catch (error) {
        console.error('Token revocation failed:', error);
        // Continue with logout even if revocation fails
      }
    }

    this.tokens = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.tokens?.access_token && !this.isTokenExpired());
  }

  /**
   * Get access token (automatically refreshes if expired)
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await this.getValidAccessToken();
    } catch {
      return null;
    }
  }

  /**
   * Get current tokens
   */
  getTokens(): OAuthTokens | null {
    return this.tokens;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private generateAuthorizationUrl(): { url: string; state: string; codeVerifier: string } {
    const authUrl = new URL(`${this.config.heimdallUrl}/oauth-provider/authorize`);

    // Required parameters
    authUrl.searchParams.set('client_id', this.config.clientId);
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', this.config.scopes!.join(' '));

    // State for CSRF protection
    const state = this.generateRandomString(32);
    authUrl.searchParams.set('state', state);

    // PKCE
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return {
      url: authUrl.toString(),
      state,
      codeVerifier
    };
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const response = await fetch(`${this.config.heimdallUrl}/oauth-provider/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        code_verifier: codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.error || 'Token exchange failed');
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<OAuthTokens> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.config.heimdallUrl}/oauth-provider/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token,
        client_id: this.config.clientId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || error.error || 'Token refresh failed');
    }

    return response.json();
  }

  private async revokeToken(token: string): Promise<void> {
    await fetch(`${this.config.heimdallUrl}/oauth-provider/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        token_type_hint: 'access_token',
        client_id: this.config.clientId
      })
    });
  }

  private setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
    this.tokenExpiresAt = Date.now() + (tokens.expires_in * 1000);
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    // Consider expired 5 minutes before actual expiration
    return Date.now() >= (this.tokenExpiresAt - 5 * 60 * 1000);
  }

  private async getValidAccessToken(): Promise<string> {
    if (!this.tokens?.access_token) {
      throw new Error('Not authenticated');
    }

    if (this.isTokenExpired()) {
      const tokens = await this.refreshAccessToken();
      this.setTokens(tokens);
    }

    return this.tokens.access_token;
  }

  private generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  private generateCodeVerifier(): string {
    return this.generateRandomString(32);
  }

  private generateCodeChallenge(verifier: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      return this.base64URLEncode(new Uint8Array(hash));
    }) as any; // Type hack for sync code
  }

  private base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...Array.from(buffer)));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

// Singleton instance
let oauthClient: HeimdallOAuthClient | null = null;

export function initializeOAuthClient(config: OAuthConfig): HeimdallOAuthClient {
  if (!oauthClient) {
    oauthClient = new HeimdallOAuthClient(config);
  }
  return oauthClient;
}

export function getOAuthClient(): HeimdallOAuthClient {
  if (!oauthClient) {
    throw new Error('OAuth client not initialized. Call initializeOAuthClient first.');
  }
  return oauthClient;
}