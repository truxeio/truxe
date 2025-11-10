import requests
import secrets
import hashlib

class OAuthClient:
    def __init__(self, heimdall_url, client_id, client_secret, redirect_uri):
        self.heimdall_url = heimdall_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri

    def get_authorization_url(self, state, code_challenge):
        params = {
            'response_type': 'code',
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'openid profile email',
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
        }
        import urllib.parse
        return f"{self.heimdall_url}/oauth/authorize?{urllib.parse.urlencode(params)}"

    def get_tokens(self, code, code_verifier):
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.redirect_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code_verifier': code_verifier,
        }
        response = requests.post(f"{self.heimdall_url}/oauth/token", data=data)
        response.raise_for_status()
        return response.json()

    def refresh_access_token(self, refresh_token):
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': self.client_id,
            'client_secret': self.client_secret,
        }
        response = requests.post(f"{self.heimdall_url}/oauth/token", data=data)
        response.raise_for_status()
        return response.json()

    def generate_pkce(self):
        code_verifier = secrets.token_urlsafe(64)
        code_challenge = hashlib.sha256(code_verifier.encode('utf-8')).digest()
        code_challenge = self._base64_url_encode(code_challenge)
        return code_verifier, code_challenge

    def _base64_url_encode(self, data):
        import base64
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')