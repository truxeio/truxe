"""
OAuth Client for Heimdall (Python)

Provides helper functions for OAuth 2.0 flows:
- Authorization URL generation
- Code exchange for tokens
- Token refresh
- Token revocation
- PKCE support
"""

import secrets
import hashlib
import base64
from typing import Dict, Any, Optional
import requests


class HeimdallOAuthClient:
    """Heimdall OAuth 2.0 client"""

    def __init__(
        self,
        heimdall_url: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: Optional[list] = None,
        use_pkce: bool = False
    ):
        self.heimdall_url = heimdall_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes or ['openid', 'profile', 'email']
        self.use_pkce = use_pkce

    def generate_authorization_url(self, state: Optional[str] = None) -> Dict[str, str]:
        """
        Generate authorization URL for OAuth flow

        Returns:
            dict: Contains 'url', 'state', and optionally 'code_verifier'
        """
        # Generate state for CSRF protection
        if not state:
            state = self._generate_random_string(32)

        # Build authorization URL
        auth_url = f"{self.heimdall_url}/oauth-provider/authorize"
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(self.scopes),
            'state': state
        }

        result = {
            'url': self._build_url(auth_url, params),
            'state': state
        }

        # Add PKCE if enabled
        if self.use_pkce:
            code_verifier = self._generate_code_verifier()
            code_challenge = self._generate_code_challenge(code_verifier)

            params['code_challenge'] = code_challenge
            params['code_challenge_method'] = 'S256'

            result['url'] = self._build_url(auth_url, params)
            result['code_verifier'] = code_verifier

        # Add nonce for OpenID Connect
        if 'openid' in self.scopes:
            nonce = self._generate_random_string(16)
            params['nonce'] = nonce
            result['url'] = self._build_url(auth_url, params)
            result['nonce'] = nonce

        return result

    def exchange_code_for_token(
        self,
        code: str,
        code_verifier: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token

        Args:
            code: Authorization code
            code_verifier: PKCE code verifier (if using PKCE)

        Returns:
            dict: Token response with access_token, refresh_token, etc.
        """
        token_url = f"{self.heimdall_url}/oauth-provider/token"

        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.redirect_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }

        # Add PKCE verifier if used
        if code_verifier:
            data['code_verifier'] = code_verifier

        response = requests.post(
            token_url,
            json=data,
            headers={'Content-Type': 'application/json'}
        )

        if not response.ok:
            error_data = response.json()
            raise Exception(
                error_data.get('error_description') or
                error_data.get('error') or
                'Token exchange failed'
            )

        return response.json()

    def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token

        Args:
            refresh_token: Refresh token

        Returns:
            dict: New token response
        """
        token_url = f"{self.heimdall_url}/oauth-provider/token"

        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }

        response = requests.post(
            token_url,
            json=data,
            headers={'Content-Type': 'application/json'}
        )

        if not response.ok:
            error_data = response.json()
            raise Exception(
                error_data.get('error_description') or
                error_data.get('error') or
                'Token refresh failed'
            )

        return response.json()

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get user info from userinfo endpoint

        Args:
            access_token: Access token

        Returns:
            dict: User profile information
        """
        userinfo_url = f"{self.heimdall_url}/oauth-provider/userinfo"

        response = requests.get(
            userinfo_url,
            headers={'Authorization': f'Bearer {access_token}'}
        )

        if not response.ok:
            raise Exception('Failed to fetch user info')

        return response.json()

    def introspect_token(
        self,
        token: str,
        token_type_hint: str = 'access_token'
    ) -> Dict[str, Any]:
        """
        Introspect token (validate server-side)

        Args:
            token: Token to introspect
            token_type_hint: Token type hint (access_token or refresh_token)

        Returns:
            dict: Introspection response
        """
        introspect_url = f"{self.heimdall_url}/oauth-provider/introspect"

        data = {
            'token': token,
            'token_type_hint': token_type_hint,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }

        response = requests.post(
            introspect_url,
            json=data,
            headers={'Content-Type': 'application/json'}
        )

        if not response.ok:
            raise Exception('Token introspection failed')

        return response.json()

    def revoke_token(
        self,
        token: str,
        token_type_hint: str = 'access_token'
    ) -> bool:
        """
        Revoke token (logout)

        Args:
            token: Token to revoke
            token_type_hint: Token type hint

        Returns:
            bool: True if successful
        """
        revoke_url = f"{self.heimdall_url}/oauth-provider/revoke"

        data = {
            'token': token,
            'token_type_hint': token_type_hint,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }

        try:
            response = requests.post(
                revoke_url,
                json=data,
                headers={'Content-Type': 'application/json'}
            )
            return response.ok
        except Exception as e:
            print(f'Token revocation failed: {e}')
            return False

    # Helper methods

    @staticmethod
    def _generate_random_string(length: int = 32) -> str:
        """Generate random string for state/nonce"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def _generate_code_verifier() -> str:
        """Generate PKCE code verifier"""
        return secrets.token_urlsafe(32)

    @staticmethod
    def _generate_code_challenge(verifier: str) -> str:
        """Generate PKCE code challenge from verifier"""
        digest = hashlib.sha256(verifier.encode('utf-8')).digest()
        return base64.urlsafe_b64encode(digest).decode('utf-8').rstrip('=')

    @staticmethod
    def _build_url(base_url: str, params: Dict[str, str]) -> str:
        """Build URL with query parameters"""
        from urllib.parse import urlencode
        return f"{base_url}?{urlencode(params)}"