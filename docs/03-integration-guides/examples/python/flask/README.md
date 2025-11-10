# Truxe OAuth 2.0 - Flask Example

Production-ready Python Flask application with OAuth 2.0 integration.

## Features

✅ OAuth 2.0 Authorization Code Flow
✅ PKCE support
✅ `@require_auth` decorator for protected routes
✅ Automatic token refresh
✅ Secure session management
✅ Token revocation on logout
✅ Clean Python code with type hints

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
TRUXE_URL=https://api.truxe.io
OAUTH_CLIENT_ID=your_client_id_here
OAUTH_CLIENT_SECRET=your_client_secret_here
OAUTH_REDIRECT_URI=http://localhost:5000/auth/callback

FLASK_ENV=development
PORT=5000
SECRET_KEY=your_secret_key_here

USE_PKCE=true
```

Generate `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Run

```bash
python app.py
```

Open http://localhost:5000

## Project Structure

```
.
├── app.py                # Flask application
├── oauth_client.py       # OAuth client utility
├── requirements.txt      # Dependencies
├── .env.example         # Environment template
└── README.md            # This file
```

## Usage

### Protected Routes

Use the `@require_auth` decorator:

```python
from app import require_auth

@app.route('/protected')
@require_auth
def protected():
    user = session.get('user')
    return f"Hello, {user['name']}!"
```

### OAuth Client

```python
from oauth_client import TruxeOAuthClient

client = TruxeOAuthClient(
    truxe_url='https://api.truxe.io',
    client_id='your_client_id',
    client_secret='your_client_secret',
    redirect_uri='http://localhost:5000/auth/callback',
    scopes=['openid', 'profile', 'email'],
    use_pkce=True
)

# Generate authorization URL
auth_data = client.generate_authorization_url()

# Exchange code for tokens
tokens = client.exchange_code_for_token(code, code_verifier)

# Refresh tokens
new_tokens = client.refresh_access_token(refresh_token)

# Get user info
user = client.get_user_info(access_token)
```

## Production Deployment

### Environment

```env
FLASK_ENV=production
SECRET_KEY=very_secure_random_string
TRUXE_URL=https://api.truxe.io
OAUTH_REDIRECT_URI=https://yourapp.com/auth/callback
```

### With Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### With Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## License

MIT