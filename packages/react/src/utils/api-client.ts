import type {
  AuthResponse,
  MagicLinkResponse,
  Organization,
  Session,
  TokenPair,
  User,
} from '../types';

/**
 * Heimdall API Client
 *
 * Handles all HTTP requests to the Heimdall API with:
 * - Automatic token refresh
 * - Token storage using localStorage
 * - Consistent error handling
 */
export class HeimdallAPIClient {
  private apiUrl: string;
  private publishableKey: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(apiUrl: string, publishableKey: string) {
    this.apiUrl = apiUrl;
    this.publishableKey = publishableKey;
    this.loadTokens();
  }

  // ============================================
  // Token Management
  // ============================================

  private loadTokens(): void {
    if (typeof window === 'undefined') return;

    this.accessToken = localStorage.getItem('heimdall_access_token');
    this.refreshToken = localStorage.getItem('heimdall_refresh_token');
  }

  private saveTokens(tokens: TokenPair): void {
    if (typeof window === 'undefined') return;

    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;

    localStorage.setItem('heimdall_access_token', tokens.accessToken);
    localStorage.setItem('heimdall_refresh_token', tokens.refreshToken);
    localStorage.setItem(
      'heimdall_token_expires_at',
      String(Date.now() + tokens.expiresIn * 1000)
    );
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window === 'undefined') return;

    localStorage.removeItem('heimdall_access_token');
    localStorage.removeItem('heimdall_refresh_token');
    localStorage.removeItem('heimdall_token_expires_at');
  }

  // ============================================
  // HTTP Request Helper
  // ============================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Heimdall-Publishable-Key': this.publishableKey,
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.request<T>(endpoint, options);
      }

      this.clearTokens();
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Request failed',
      }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // Authentication Methods
  // ============================================

  async signInWithMagicLink(email: string): Promise<MagicLinkResponse> {
    return this.request('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyMagicLink(token: string): Promise<AuthResponse> {
    const result = await this.request<AuthResponse>('/auth/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    this.saveTokens(result.tokens);
    return result;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResponse> {
    const response: any = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Handle API response format: { success, data: { user, tokens } }
    const result = {
      user: response.data.user,
      tokens: {
        accessToken: response.data.tokens.access_token,
        refreshToken: response.data.tokens.refresh_token,
        expiresIn: response.data.tokens.expires_in,
      },
    };

    this.saveTokens(result.tokens);
    return result;
  }

  async signUp(
    email: string,
    password: string,
    metadata?: Record<string, any>
  ): Promise<AuthResponse> {
    const response: any = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, metadata }),
    });

    // Handle API response format: { success, data: { user, tokens } }
    const result = {
      user: response.data.user,
      tokens: {
        accessToken: response.data.tokens.access_token,
        refreshToken: response.data.tokens.refresh_token,
        expiresIn: response.data.tokens.expires_in,
      },
    };

    this.saveTokens(result.tokens);
    return result;
  }

  async signOut(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearTokens();
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const result = await this.request<TokenPair>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      this.saveTokens(result);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // User Methods
  // ============================================

  async getUser(): Promise<User> {
    return this.request('/auth/me');
  }

  async updateUser(updates: Partial<User>): Promise<User> {
    return this.request('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // ============================================
  // Session Methods
  // ============================================

  async getSession(): Promise<Session> {
    // Note: The API doesn't have a separate session endpoint
    // Session data is included in the /auth/me response
    const user = await this.getUser();
    return {
      id: user.id,
      userId: user.id,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: localStorage.getItem('heimdall_token_expires_at') || '',
    } as Session;
  }

  async getSessions(): Promise<Session[]> {
    // TODO: Implement when API supports session listing
    return [];
  }

  async revokeSession(_sessionId: string): Promise<void> {
    // Use logout for current session
    // TODO: Implement proper session revocation when API supports it
    await this.signOut();
  }

  // ============================================
  // Organization Methods
  // ============================================

  async getOrganizations(): Promise<Organization[]> {
    return this.request('/auth/organizations');
  }

  async getOrganization(orgId: string): Promise<Organization> {
    return this.request(`/organizations/${orgId}`);
  }

  async setActiveOrganization(orgId: string): Promise<void> {
    await this.request('/auth/switch-org', {
      method: 'POST',
      body: JSON.stringify({ organizationId: orgId }),
    });
  }

  async createOrganization(data: { name: string; slug?: string }): Promise<Organization> {
    return this.request('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
