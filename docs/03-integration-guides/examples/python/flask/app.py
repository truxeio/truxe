"""
Flask OAuth 2.0 Client Example for Heimdall

Complete Flask application with OAuth 2.0 integration:
- Authorization Code Flow
- PKCE support
- Token refresh
- Protected routes with decorator
- Session management
"""

import os
import secrets
from functools import wraps
from datetime import datetime, timedelta

from flask import Flask, redirect, request, session, jsonify, render_template_string
from dotenv import load_dotenv

from oauth_client import HeimdallOAuthClient

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)

# Initialize OAuth client
oauth_client = HeimdallOAuthClient(
    heimdall_url=os.getenv('HEIMDALL_URL'),
    client_id=os.getenv('OAUTH_CLIENT_ID'),
    client_secret=os.getenv('OAUTH_CLIENT_SECRET'),
    redirect_uri=os.getenv('OAUTH_REDIRECT_URI'),
    scopes=['openid', 'profile', 'email'],
    use_pkce=os.getenv('USE_PKCE', 'true').lower() == 'true'
)

# ============================================================================
# Decorators
# ============================================================================

def require_auth(f):
    """Decorator to require authentication for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        access_token = session.get('access_token')
        expires_at = session.get('expires_at')

        # Not authenticated - redirect to login
        if not access_token:
            session['return_to'] = request.url
            return redirect('/auth/login')

        # Token expired - try to refresh
        if expires_at and datetime.now().timestamp() >= expires_at - 300:  # 5 min buffer
            refresh_token = session.get('refresh_token')

            if refresh_token:
                try:
                    # Refresh the token
                    tokens = oauth_client.refresh_access_token(refresh_token)

                    # Update session
                    session['access_token'] = tokens['access_token']
                    session['refresh_token'] = tokens.get('refresh_token', refresh_token)
                    session['expires_at'] = datetime.now().timestamp() + tokens['expires_in']
                except Exception as e:
                    app.logger.error(f'Token refresh failed: {e}')
                    session.clear()
                    session['return_to'] = request.url
                    return redirect('/auth/login')
            else:
                # No refresh token - require re-authentication
                session.clear()
                session['return_to'] = request.url
                return redirect('/auth/login')

        return f(*args, **kwargs)

    return decorated_function

# ============================================================================
# Routes - Public
# ============================================================================

@app.route('/')
def index():
    """Home page"""
    is_authenticated = 'access_token' in session and session.get('expires_at', 0) > datetime.now().timestamp()
    user = session.get('user')

    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Heimdall OAuth - Flask Example</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white;
                   text-decoration: none; border-radius: 5px; margin: 10px 5px; }
            .btn:hover { background: #0056b3; }
            .btn-danger { background: #dc3545; }
            .btn-danger:hover { background: #c82333; }
            .user-info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1>Heimdall OAuth 2.0 - Flask Example</h1>
        <p>This is a demonstration of OAuth 2.0 Authorization Code Flow with Heimdall.</p>

        {% if is_authenticated %}
            <div class="user-info">
                <h2>✅ You are authenticated!</h2>
                <p><strong>User:</strong> {{ user.get('email', 'Unknown') }}</p>
                <p><strong>Name:</strong> {{ user.get('name', 'Unknown') }}</p>
            </div>
            <a href="/dashboard" class="btn">Go to Dashboard</a>
            <a href="/auth/logout" class="btn btn-danger">Logout</a>
        {% else %}
            <p>Click below to sign in with Heimdall:</p>
            <a href="/auth/login" class="btn">Sign in with Heimdall</a>
        {% endif %}

        <hr style="margin: 40px 0;">
        <h3>Features Demonstrated:</h3>
        <ul>
            <li>OAuth 2.0 Authorization Code Flow</li>
            <li>PKCE (Proof Key for Code Exchange)</li>
            <li>State parameter for CSRF protection</li>
            <li>Automatic token refresh</li>
            <li>Secure session management</li>
            <li>Protected routes with @require_auth decorator</li>
            <li>Token revocation on logout</li>
        </ul>
    </body>
    </html>
    '''

    return render_template_string(html, is_authenticated=is_authenticated, user=user)

@app.route('/error')
def error():
    """Error page"""
    message = request.args.get('message', 'An error occurred')

    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Error</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .error { background: #f8d7da; color: #721c24; padding: 20px; border-radius: 5px;
                     border-left: 4px solid #f5c6cb; }
            .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white;
                   text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <h1>Authentication Error</h1>
        <div class="error">
            <strong>Error:</strong> {{ message }}
        </div>
        <a href="/" class="btn">Go Home</a>
    </body>
    </html>
    '''

    return render_template_string(html, message=message), 400

# ============================================================================
# Routes - Authentication
# ============================================================================

@app.route('/auth/login')
def auth_login():
    """Initiate OAuth authorization flow"""
    try:
        # Generate authorization URL
        auth_data = oauth_client.generate_authorization_url()

        # Store state and code_verifier in session
        session['oauth_state'] = auth_data['state']
        if 'code_verifier' in auth_data:
            session['code_verifier'] = auth_data['code_verifier']
        if 'nonce' in auth_data:
            session['oauth_nonce'] = auth_data['nonce']

        # Redirect to Heimdall authorization page
        return redirect(auth_data['url'])
    except Exception as e:
        app.logger.error(f'Login error: {e}')
        return redirect(f'/error?message={str(e)}')

@app.route('/auth/callback')
def auth_callback():
    """Handle OAuth callback from Heimdall"""
    # Get query parameters
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    error_description = request.args.get('error_description')

    # Handle authorization errors
    if error:
        app.logger.error(f'Authorization error: {error} - {error_description}')
        return redirect(f'/error?message={error_description or error}')

    # Validate required parameters
    if not code or not state:
        return redirect('/error?message=Missing required parameters'), 400

    # Validate state parameter (CSRF protection)
    expected_state = session.get('oauth_state')
    if state != expected_state:
        app.logger.error('State mismatch - potential CSRF attack')
        return redirect('/error?message=Invalid state parameter'), 403

    # Clear state from session
    session.pop('oauth_state', None)

    try:
        # Get code_verifier if using PKCE
        code_verifier = session.pop('code_verifier', None)

        # Exchange authorization code for tokens
        tokens = oauth_client.exchange_code_for_token(code, code_verifier)

        # Store tokens in session
        session['access_token'] = tokens['access_token']
        session['refresh_token'] = tokens.get('refresh_token')
        session['expires_at'] = datetime.now().timestamp() + tokens['expires_in']
        session['token_type'] = tokens['token_type']
        session['scope'] = tokens['scope']

        # Fetch user info
        user = oauth_client.get_user_info(tokens['access_token'])
        session['user'] = user

        # Redirect to return URL or dashboard
        return_to = session.pop('return_to', '/dashboard')
        return redirect(return_to)
    except Exception as e:
        app.logger.error(f'Token exchange error: {e}')
        return redirect(f'/error?message=Authentication failed. Please try again.')

@app.route('/auth/logout')
def auth_logout():
    """Logout and revoke tokens"""
    access_token = session.get('access_token')

    # Revoke token on Heimdall (best effort)
    if access_token:
        try:
            oauth_client.revoke_token(access_token)
        except Exception as e:
            app.logger.error(f'Token revocation failed: {e}')
            # Continue with logout even if revocation fails

    # Clear session
    session.clear()

    return redirect('/')

@app.route('/auth/refresh', methods=['POST'])
def auth_refresh():
    """Manually refresh access token (AJAX endpoint)"""
    refresh_token = session.get('refresh_token')

    if not refresh_token:
        return jsonify({'error': 'No refresh token available'}), 401

    try:
        tokens = oauth_client.refresh_access_token(refresh_token)

        # Update session
        session['access_token'] = tokens['access_token']
        session['refresh_token'] = tokens.get('refresh_token', refresh_token)
        session['expires_at'] = datetime.now().timestamp() + tokens['expires_in']

        return jsonify({
            'success': True,
            'expires_in': tokens['expires_in']
        })
    except Exception as e:
        app.logger.error(f'Token refresh error: {e}')
        return jsonify({
            'error': 'token_refresh_failed',
            'error_description': str(e)
        }), 401

@app.route('/auth/user')
def auth_user():
    """Get current user info (AJAX endpoint)"""
    access_token = session.get('access_token')

    if not access_token:
        return jsonify({'error': 'Not authenticated'}), 401

    # Return cached user if available
    if 'user' in session:
        return jsonify(session['user'])

    try:
        user = oauth_client.get_user_info(access_token)
        session['user'] = user
        return jsonify(user)
    except Exception as e:
        app.logger.error(f'User info error: {e}')
        return jsonify({
            'error': 'user_info_failed',
            'error_description': str(e)
        }), 401

# ============================================================================
# Routes - Protected
# ============================================================================

@app.route('/dashboard')
@require_auth
def dashboard():
    """Protected dashboard (requires authentication)"""
    user = session.get('user', {})

    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .user-card { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .btn { display: inline-block; padding: 10px 20px; background: #dc3545; color: white;
                   text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .btn:hover { background: #c82333; }
            pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; }
        </style>
    </head>
    <body>
        <h1>🎉 Dashboard</h1>
        <p>Welcome to your protected dashboard!</p>

        <div class="user-card">
            <h2>User Profile</h2>
            <p><strong>ID:</strong> {{ user.get('sub') }}</p>
            <p><strong>Email:</strong> {{ user.get('email') }}</p>
            <p><strong>Email Verified:</strong> {{ '✅ Yes' if user.get('email_verified') else '❌ No' }}</p>
            <p><strong>Name:</strong> {{ user.get('name', 'Not provided') }}</p>
        </div>

        <h3>Full User Object:</h3>
        <pre>{{ user_json }}</pre>

        <a href="/auth/logout" class="btn">Logout</a>
    </body>
    </html>
    '''

    import json
    return render_template_string(html, user=user, user_json=json.dumps(user, indent=2))

@app.route('/api/protected')
@require_auth
def api_protected():
    """Example protected API endpoint"""
    return jsonify({
        'message': 'This is a protected API endpoint',
        'user_id': session.get('user', {}).get('sub'),
        'timestamp': datetime.now().isoformat()
    })

# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    return redirect('/error?message=Page not found'), 404

@app.errorhandler(500)
def server_error(e):
    app.logger.error(f'Server error: {e}')
    return redirect('/error?message=Internal server error'), 500

# ============================================================================
# Run App
# ============================================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'

    print(f'''
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   Heimdall OAuth Flask Example                                ║
║                                                                ║
║   Server running on: http://localhost:{port}                     ║
║                                                                ║
║   Routes:                                                      ║
║   - GET  /                     Home page                      ║
║   - GET  /auth/login           Initiate OAuth flow            ║
║   - GET  /auth/callback        OAuth callback                 ║
║   - GET  /auth/logout          Logout                         ║
║   - GET  /dashboard            Protected dashboard            ║
║   - GET  /api/protected        Protected API endpoint         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    ''')

    if not os.getenv('OAUTH_CLIENT_ID') or not os.getenv('OAUTH_CLIENT_SECRET'):
        print('\n⚠️  WARNING: OAuth credentials not configured!')
        print('   Please copy .env.example to .env and fill in your credentials.\n')

    app.run(host='0.0.0.0', port=port, debug=debug)