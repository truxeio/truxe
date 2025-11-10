# Truxe OAuth Provider - Next.js App Router Example

This directory contains a production-ready example of integrating a Next.js 14+ (App Router) application with Truxe as an OAuth provider.

## Features

- **Next.js 14+ App Router**: Utilizes the latest Next.js features for server-centric applications.
- **Server Components & Server Actions**: Authentication logic is handled on the server, minimizing client-side JavaScript.
- **Middleware for Route Protection**: Uses Next.js middleware to protect routes, ensuring only authenticated users can access them.
- **TypeScript with Strict Mode**: Ensures type safety and code quality.
- **PKCE Support**: Implements Proof Key for Code Exchange (PKCE) for enhanced security.
- **Edge Runtime Compatible**: The middleware and auth logic are compatible with the Edge runtime.
- **Automatic Token Refresh (via re-login)**: The middleware detects expiring tokens and prompts the user to log in again.

## File Structure

```
app-router/
├── app/
│   ├── auth/
│   │   ├── login/page.tsx       # Page to prompt re-login
│   │   ├── callback/page.tsx    # OAuth callback handler
│   │   └── logout/route.ts      # Logout route handler
│   ├── dashboard/
│   │   └── page.tsx             # Protected dashboard page
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Public homepage
├── lib/
│   ├── oauth-client.ts          # Client for Truxe OAuth
│   └── auth.ts                  # Server Actions for auth (login, logout)
├── middleware.ts                # Middleware for protecting routes
├── package.json
├── .env.example
└── README.md
```

## Setup and Usage

### 1. Prerequisites

- Node.js (v18 or higher)
- A running instance of the Truxe OAuth Provider.

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-repo/truxe.git
cd truxe/docs/03-integration-guides/examples/nextjs/app-router
npm install
```

### 3. Environment Variables

Create a `.env.local` file by copying the `.env.example`:

```bash
cp .env.example .env.local
```

Update the `.env.local` file with your Truxe client credentials:

```
TRUXE_URL=http://localhost:3001
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_TRUXE_URL=http://localhost:3001
```

### 4. Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. OAuth Flow

1.  From the homepage, click "Login with Truxe".
2.  You will be redirected to the Truxe consent screen.
3.  Authorize the application.
4.  You will be redirected back to the application's callback URL.
5.  The app will exchange the code for tokens, set them in secure, HTTP-only cookies, and redirect you to the protected `/dashboard`.
6.  The middleware will now allow access to `/dashboard`.
7.  Clicking "Logout" will clear the cookies and redirect you to the homepage.

## Production Deployment

To run this example in production:

1.  **Build the application:**

    ```bash
    npm run build
    ```

2.  **Start the server:**

    ```bash
    npm start
    ```

3.  **Important Considerations:**
    - Ensure `NODE_ENV` is set to `production`.
    - The application must be served over HTTPS for secure cookies to work correctly.
    - Configure your hosting environment with the necessary environment variables.

## Troubleshooting

- **`invalid_redirect_uri` error**: Ensure the `OAUTH_REDIRECT_URI` in your `.env.local` file exactly matches the one registered for your client in Truxe.
- **Infinite redirect loop**: Check your middleware logic. Ensure it doesn't redirect authenticated users away from protected pages. Also, check that cookies are being set correctly.
- **Server Actions not working**: Ensure you are on Next.js 14+ and that server actions are enabled.
