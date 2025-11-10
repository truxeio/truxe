/**
 * Express.js OAuth 2.0 Client Example for Truxe
 *
 * This example demonstrates a complete OAuth 2.0 implementation with:
 * - Authorization Code Flow
 * - PKCE support
 * - Token refresh
 * - Protected routes
 * - Session management
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const { requireAuth, attachUser, checkAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-to-a-secure-random-string',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,                                 // No JavaScript access
    sameSite: 'lax',                                // CSRF protection
    maxAge: 24 * 60 * 60 * 1000                    // 24 hours
  }
}));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to auth routes
app.use('/auth', authLimiter, authRoutes);

// Check auth status for all routes (doesn't redirect)
app.use(checkAuth);

// ============================================================================
// Public Routes
// ============================================================================

/**
 * GET /
 * Home page (public)
 */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Truxe OAuth Example</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 5px;
        }
        .btn:hover {
          background: #0056b3;
        }
        .user-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <h1>Truxe OAuth 2.0 Example</h1>
      <p>This is a demonstration of OAuth 2.0 Authorization Code Flow with Truxe.</p>

      ${req.isAuthenticated ? `
        <div class="user-info">
          <h2>✅ You are authenticated!</h2>
          <p><strong>User:</strong> ${req.session.user?.email || 'Unknown'}</p>
          <p><strong>Name:</strong> ${req.session.user?.name || 'Unknown'}</p>
        </div>
        <a href="/dashboard" class="btn">Go to Dashboard</a>
        <a href="/auth/logout" class="btn" style="background: #dc3545;">Logout</a>
      ` : `
        <p>Click below to sign in with Truxe:</p>
        <a href="/auth/login" class="btn">Sign in with Truxe</a>
      `}

      <hr style="margin: 40px 0;">
      <h3>Features Demonstrated:</h3>
      <ul>
        <li>OAuth 2.0 Authorization Code Flow</li>
        <li>PKCE (Proof Key for Code Exchange)</li>
        <li>State parameter for CSRF protection</li>
        <li>Automatic token refresh</li>
        <li>Secure session management</li>
        <li>Protected routes</li>
        <li>Token revocation on logout</li>
      </ul>
    </body>
    </html>
  `);
});

/**
 * GET /error
 * Error page
 */
app.get('/error', (req, res) => {
  const message = req.query.message || 'An error occurred';
  res.status(400).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Error</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
        }
        .error {
          background: #f8d7da;
          color: #721c24;
          padding: 20px;
          border-radius: 5px;
          border-left: 4px solid #f5c6cb;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <h1>Authentication Error</h1>
      <div class="error">
        <strong>Error:</strong> ${message}
      </div>
      <a href="/" class="btn">Go Home</a>
    </body>
    </html>
  `);
});

// ============================================================================
// Protected Routes (require authentication)
// ============================================================================

/**
 * GET /dashboard
 * Protected dashboard (requires authentication)
 */
app.get('/dashboard', requireAuth, attachUser, (req, res) => {
  const user = req.user;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
        }
        .user-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .btn {
          display: inline-block;
          padding: 10px 20px;
          background: #dc3545;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 20px;
        }
        .btn:hover {
          background: #c82333;
        }
        pre {
          background: #272822;
          color: #f8f8f2;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
      </style>
    </head>
    <body>
      <h1>🎉 Dashboard</h1>
      <p>Welcome to your protected dashboard!</p>

      <div class="user-card">
        <h2>User Profile</h2>
        <p><strong>ID:</strong> ${user.sub}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Email Verified:</strong> ${user.email_verified ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Name:</strong> ${user.name || 'Not provided'}</p>
        ${user.picture ? `<p><img src="${user.picture}" alt="Profile" style="width: 100px; border-radius: 50%;"></p>` : ''}
      </div>

      <h3>Full User Object:</h3>
      <pre>${JSON.stringify(user, null, 2)}</pre>

      <h3>Session Info:</h3>
      <pre>${JSON.stringify({
        token_type: req.session.token_type,
        scope: req.session.scope,
        expires_at: new Date(req.session.expires_at).toISOString()
      }, null, 2)}</pre>

      <a href="/auth/logout" class="btn">Logout</a>
    </body>
    </html>
  `);
});

/**
 * GET /api/protected
 * Example protected API endpoint
 */
app.get('/api/protected', requireAuth, (req, res) => {
  res.json({
    message: 'This is a protected API endpoint',
    user_id: req.session.user?.sub,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 Not Found</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/">Go Home</a>
    </body>
    </html>
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>500 Server Error</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <h1>500 - Server Error</h1>
      <p>Something went wrong. Please try again later.</p>
      <a href="/">Go Home</a>
    </body>
    </html>
  `);
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   Truxe OAuth Example Server                               ║
║                                                                ║
║   Server running on: http://localhost:${PORT}                    ║
║                                                                ║
║   Routes:                                                      ║
║   - GET  /                     Home page                      ║
║   - GET  /auth/login           Initiate OAuth flow            ║
║   - GET  /auth/callback        OAuth callback                 ║
║   - GET  /auth/logout          Logout                         ║
║   - GET  /dashboard            Protected dashboard            ║
║   - GET  /api/protected        Protected API endpoint         ║
║                                                                ║
║   Configuration:                                               ║
║   - Truxe URL: ${process.env.TRUXE_URL?.substring(0, 30).padEnd(30) || 'Not configured'.padEnd(30)}║
║   - Client ID:    ${process.env.OAUTH_CLIENT_ID?.substring(0, 30).padEnd(30) || 'Not configured'.padEnd(30)}║
║   - PKCE Enabled: ${(process.env.USE_PKCE === 'true' ? 'Yes' : 'No').padEnd(30)}║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);

  if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
    console.warn('\n⚠️  WARNING: OAuth credentials not configured!');
    console.warn('   Please copy .env.example to .env and fill in your credentials.\n');
  }
});

module.exports = app;