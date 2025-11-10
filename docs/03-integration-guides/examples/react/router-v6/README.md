# Truxe OAuth Provider - React Router v6 Example

This directory contains a production-ready example of integrating a React Single-Page Application (SPA) with Truxe as an OAuth provider, using React Router v6 for routing.

## Features

- **React Router v6**: Uses the latest version of React Router for declarative, component-based routing.
- **Context API for Auth State**: Manages authentication state globally and efficiently using React's Context API.
- **Protected Routes**: A `ProtectedRoute` component guards routes that require authentication.
- **TypeScript Support**: Fully typed with TypeScript for a robust developer experience.
- **PKCE Implementation**: Enhances security for SPAs by using Proof Key for Code Exchange.
- **Automatic Token Refresh**: The `AuthContext` includes logic to automatically refresh tokens before they expire.
- **In-Memory Token Storage**: Follows the latest security best practices by storing tokens in memory to prevent XSS attacks.

## File Structure

```
router-v6/
├── src/
│   ├── lib/
│   │   └── oauth-client.ts    # Client for Truxe OAuth
│   ├── contexts/
│   │   └── AuthContext.tsx    # Manages auth state and logic
│   ├── components/
│   │   ├── ProtectedRoute.tsx # Guards protected routes
│   │   ├── LoginPage.tsx      # Login page component
│   │   ├── CallbackPage.tsx   # Handles OAuth callback
│   │   └── DashboardPage.tsx  # Example protected page
│   ├── App.tsx                # Main app component with routes
│   └── main.tsx               # Application entry point
├── index.html
├── package.json
├── .env.example
└── README.md
```

## Setup and Usage

### 1. Prerequisites

- Node.js (v18 or higher)
- A running instance of the Truxe OAuth Provider.
- Your Truxe client must be configured as a "Public" client (since this is a SPA).

### 2. Installation

```bash
git clone https://github.com/your-repo/truxe.git
cd truxe/docs/03-integration-guides/examples/react/router-v6
npm install
```

### 3. Environment Variables

Create a `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Update `.env` with your client details. Note the `VITE_` prefix required by Vite.

```
VITE_TRUXE_URL=http://localhost:3001
VITE_OAUTH_CLIENT_ID=your-client-id
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/callback
```

### 4. Running the Application

Start the development server (defaults to port 5173):

```bash
npm run dev
```

### 5. OAuth Flow

1.  Visit `http://localhost:5173`.
2.  Click "Login", which takes you to the `/login` route.
3.  Click "Login with Truxe".
4.  You are redirected to Truxe to authorize the application.
5.  After authorization, you are redirected to `/callback`.
6.  The `CallbackPage` exchanges the authorization code for tokens and stores them in memory.
7.  You are then redirected to the protected `/dashboard` page.

## Security Note on SPAs and Tokens

This example stores tokens in-memory, which is the most secure method for a Single-Page Application, as it prevents tokens from being accessed by XSS attacks targeting `localStorage` or `sessionStorage`. The trade-off is that the user will need to log in again if they refresh the page on a protected route. A more advanced implementation could use a backend-for-frontend (BFF) or a silent refresh mechanism on the initial app load to persist the session across page loads.

## Production Build

To create a production build:

```bash
npm run build
```

This will create a `dist` folder with the optimized, static assets, which you can then serve with any static file server.
