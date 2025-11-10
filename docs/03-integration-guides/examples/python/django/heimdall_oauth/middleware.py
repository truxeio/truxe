import time
from django.shortcuts import redirect
from django.conf import settings
from .oauth_client import OAuthClient

class OAuthTokenRefreshMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.oauth_client = OAuthClient(
            heimdall_url=settings.HEIMDALL_URL,
            client_id=settings.OAUTH_CLIENT_ID,
            client_secret=settings.OAUTH_CLIENT_SECRET,
            redirect_uri=settings.OAUTH_REDIRECT_URI,
        )

    def __call__(self, request):
        # We only care about refreshing if the user is authenticated
        if 'access_token' in request.session:
            expires_at = request.session.get('expires_at')
            
            # Check if token is expiring soon (e.g., within the next 5 minutes)
            if expires_at and time.time() >= expires_at - 300:
                refresh_token = request.session.get('refresh_token')
                
                if refresh_token:
                    try:
                        tokens = self.oauth_client.refresh_access_token(refresh_token)
                        request.session['access_token'] = tokens['access_token']
                        request.session['expires_at'] = time.time() + tokens['expires_in']
                        if 'refresh_token' in tokens:
                            request.session['refresh_token'] = tokens['refresh_token']
                    except Exception:
                        # If refresh fails, flush the session and force re-login
                        request.session.flush()
                        # We don't redirect here, the view's auth check will handle it
                        pass

        response = self.get_response(request)
        return response