# Truxe OAuth Provider - Python Django Example

This directory contains a production-ready example of integrating a Django application with Truxe as an OAuth provider.

## Features

- **Django 4.x Compatible**: Built for modern Django versions.
- **Custom OAuth App**: A dedicated Django app (`truxe_oauth`) to encapsulate all authentication logic.
- **Middleware for Auto Token Refresh**: A middleware that automatically refreshes the access token in the background before it expires.
- **`@require_oauth` Decorator**: A simple decorator to protect your views and ensure the user is authenticated.
- **Template Integration**: Shows how to create login, dashboard, and logout flows using Django templates.
- **PKCE Support**: Implements Proof Key for Code Exchange (PKCE) for enhanced security.
- **Production Deployment Notes**: Includes guidance for running with Gunicorn and Nginx.

## File Structure

```
django/
├── truxe_oauth/
│   ├── __init__.py
│   ├── oauth_client.py    # Client for Truxe OAuth
│   ├── middleware.py      # Middleware for token refresh
│   ├── decorators.py      # Decorator for view protection
│   └── views.py           # Login, callback, and logout views
├── myproject/
│   ├── settings.py        # Django settings, configured for OAuth
│   ├── urls.py            # URL routing
│   └── ...
├── templates/
│   ├── login.html
│   └── dashboard.html
├── manage.py
├── requirements.txt
├── .env.example
└── README.md
```

## Setup and Usage

### 1. Prerequisites

- Python (3.8 or higher)
- A running instance of the Truxe OAuth Provider.

### 2. Installation

1.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

### 3. Environment Variables

Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Update `.env` with your credentials:

```
TRUXE_URL=http://localhost:3001
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:8000/oauth/callback
DJANGO_SECRET_KEY=a-very-secret-key-for-django
```

### 4. Database Migrations

Run the initial Django migrations:

```bash
python manage.py migrate
```

### 5. Running the Application

Start the development server:

```bash
python manage.py runserver
```

The application will be available at `http://localhost:8000`.

### 6. OAuth Flow

1.  Visit `http://localhost:8000`.
2.  Click "Login with Truxe".
3.  You will be redirected to Truxe to authorize the application.
4.  After authorization, you'll be redirected back to the app and logged in.
5.  You will be taken to the protected `/dashboard` page.

## Production Deployment (Gunicorn + Nginx)

-   **Gunicorn**: Use Gunicorn as the WSGI server.
    `gunicorn myproject.wsgi:application --bind 0.0.0.0:8000`
-   **Nginx**: Use Nginx as a reverse proxy in front of Gunicorn to handle static files and terminate SSL.
-   **`.env`**: Do not commit your `.env` file. Use your hosting platform's system for managing environment variables.
-   **`DEBUG`**: Set `DEBUG = False` in `settings.py` for production.
-   **`ALLOWED_HOSTS`**: Configure `ALLOWED_HOSTS` in `settings.py` with your domain name.

