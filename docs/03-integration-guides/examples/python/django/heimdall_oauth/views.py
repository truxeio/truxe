from django.shortcuts import render, redirect
from django.conf import settings
from .oauth_client import OAuthClient
import secrets
import time

oauth_client = OAuthClient(
    heimdall_url=settings.HEIMDALL_URL,
    client_id=settings.OAUTH_CLIENT_ID,
    client_secret=settings.OAUTH_CLIENT_SECRET,
    redirect_uri=settings.OAUTH_REDIRECT_URI,
)

def login_view(request):
    state = secrets.token_hex(16)
    code_verifier, code_challenge = oauth_client.generate_pkce()
    
    request.session['oauth_state'] = state
    request.session['oauth_code_verifier'] = code_verifier
    
    authorization_url = oauth_client.get_authorization_url(state, code_challenge)
    return redirect(authorization_url)

def callback_view(request):
    state = request.GET.get('state')
    code = request.GET.get('code')
    
    saved_state = request.session.get('oauth_state')
    code_verifier = request.session.get('oauth_code_verifier')

    if state != saved_state or not code or not code_verifier:
        return render(request, 'login.html', {'error': 'Invalid state or code.'})

    try:
        tokens = oauth_client.get_tokens(code, code_verifier)
        request.session['access_token'] = tokens['access_token']
        request.session['expires_at'] = time.time() + tokens['expires_in']
        if 'refresh_token' in tokens:
            request.session['refresh_token'] = tokens['refresh_token']
        
        # Clean up session
        del request.session['oauth_state']
        del request.session['oauth_code_verifier']

        return redirect(settings.LOGIN_REDIRECT_URL)
    except Exception as e:
        print(e)
        return render(request, 'login.html', {'error': 'Failed to fetch token.'})

def logout_view(request):
    request.session.flush()
    return redirect('/')