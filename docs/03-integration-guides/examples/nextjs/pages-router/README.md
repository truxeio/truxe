# Truxe OAuth Provider - Next.js Pages Router Example

This directory contains a production-ready example of integrating a Next.js (Pages Router) application with Truxe as an OAuth provider.

## Features

- **Next.js Pages Router**: A classic, battle-tested approach to building Next.js applications.
- **API Routes for OAuth**: Handles all OAuth logic (login, callback, logout, refresh) within the Next.js API layer.
- **`getServerSideProps` for SSR Auth**: Fetches data and protects pages on the server before they are rendered.
- **HOC for Route Protection (`withAuth`)**: A Higher-Order Component that wraps `getServerSideProps` to provide authentication checks.
- **TypeScript Support**: Fully typed for a better developer experience.
- **PKCE Implementation**: Enhances security by using Proof Key for Code Exchange.
- **Cookie-Based Sessions**: Manages authentication state using secure, HTTP-only cookies.

## File Structure

```
pages-router/
├── pages/
│   ├── api/
│   │   └── auth/
│   │       ├── login.ts       # Initiates login flow
│   │       ├── callback.ts    # Handles OAuth callback
│   │       ├── logout.ts      # Clears session
│   │       └── refresh.ts     # (Optional) Refreshes token
│   ├── auth/
│   │   └── login.tsx        # Redirect page for login
│   ├── dashboard.tsx        # Protected dashboard page
│   ├── _app.tsx
│   └── index.tsx            # Public homepage
├── lib/
│   ├── oauth-client.ts      # Client for Truxe OAuth
│   └── with-auth.tsx        # HOC for protecting pages
├── package.json
├── .env.example
└── README.md
```

## Setup and Usage

### 1. Prerequisites

- Node.js (v18 or higher)
- A running instance of the Truxe OAuth Provider.

### 2. Installation

```bash
git clone https://github.com/your-repo/truxe.git
cd truxe/docs/03-integration-guides/examples/nextjs/pages-router
npm install
```

### 3. Environment Variables

Create a `.env.local` file by copying `.env.example`:

```bash
cp .env.example .env.local
```

Update `.env.local` with your client credentials:

```
TRUXE_URL=http://localhost:3001
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
SESSION_COOKIE_SECRET=a-very-strong-and-long-secret-for-session-cookies
```

### 4. Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. OAuth Flow

1.  From the homepage, click "Login with Truxe".
2.  You are redirected to `/api/auth/login`, which in turn redirects to Truxe.
3.  After authorizing, Truxe redirects to `/api/auth/callback`.
4.  The callback handler exchanges the code for tokens, sets them in cookies, and redirects to `/dashboard`.
5.  The `withAuth` HOC on the dashboard page verifies the tokens. If they are expiring, it attempts to refresh them automatically.

## Production Deployment

1.  **Build the application:** `npm run build`
2.  **Start the server:** `npm start`
3.  **Important:** Ensure `NODE_ENV` is `production` and serve over HTTPS for secure cookies.

## Troubleshooting

- **`invalid_redirect_uri`**: Ensure the `OAUTH_REDIRECT_URI` in `.env.local` matches the one in Truxe exactly.
- **Redirect loops**: Check that cookies are being set correctly on the same domain and path. Ensure your browser is not blocking third-party cookies if Truxe is on a different domain.
