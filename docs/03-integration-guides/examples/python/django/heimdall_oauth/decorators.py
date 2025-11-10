from functools import wraps
from django.shortcuts import redirect
from django.conf import settings
from .oauth_client import OAuthClient
import time

oauth_client = OAuthClient(
    heimdall_url=settings.HEIMDALL_URL,
    client_id=settings.OAUTH_CLIENT_ID,
    client_secret=settings.OAUTH_CLIENT_SECRET,
    redirect_uri=settings.OAUTH_REDIRECT_URI,
)

def require_oauth(view_func):
    """Decorator to require OAuth authentication"""
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        access_token = request.session.get('access_token')
        expires_at = request.session.get('expires_at')

        if not access_token:
            request.session['next'] = request.get_full_path()
            return redirect('oauth_login')

        # Check if token is expiring soon (5 minutes)
        if expires_at and time.time() >= expires_at - 300:
            refresh_token = request.session.get('refresh_token')
            if refresh_token:
                try:
                    tokens = oauth_client.refresh_access_token(refresh_token)
                    request.session['access_token'] = tokens['access_token']
                    request.session['expires_at'] = time.time() + tokens['expires_in']
                    if 'refresh_token' in tokens:
                        request.session['refresh_token'] = tokens['refresh_token']
                except Exception as e:
                    # If refresh fails, log out user
                    request.session.flush()
                    return redirect('oauth_login')

        return view_func(request, *args, **kwargs)

    return wrapper