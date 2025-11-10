# Truxe OAuth Provider - Fastify Example

This directory contains a production-ready example of integrating a Fastify (TypeScript) application with Truxe as an OAuth provider.

## Features

- **TypeScript with Strict Mode**: Ensures type safety and code quality.
- **Plugin-Based Architecture**: Modular and extensible authentication logic.
- **Type-Safe OAuth Client**: A dedicated client for interacting with the Truxe OAuth server.
- **PKCE Support**: Implements Proof Key for Code Exchange (PKCE) for enhanced security, protecting against authorization code interception attacks.
- **Automatic Token Refresh**: Middleware automatically refreshes expired access tokens using the refresh token.
- **Production Deployment Guide**: Includes notes on running the application in a production environment.
- **Decorators**: Uses Fastify decorators (`@authenticate`) for protecting routes.

## File Structure

```
fastify/
├── src/
│   ├── server.ts           # Main Fastify server setup
│   ├── oauth-client.ts     # Client for Truxe OAuth interaction
│   ├── plugins/
│   │   └── auth.ts         # Authentication plugin and decorator
│   └── routes/
│       └── auth.ts         # OAuth login, callback, and logout routes
├── package.json
├── tsconfig.json
├── .env.example            # Example environment variables
└── README.md               # This file
```

## Setup and Usage

### 1. Prerequisites

- Node.js (v18 or higher)
- A running instance of the Truxe OAuth Provider.

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-repo/truxe.git
cd truxe/docs/03-integration-guides/examples/nodejs/fastify
npm install
```

### 3. Environment Variables

Create a `.env` file by copying the `.env.example`:

```bash
cp .env.example .env
```

Update the `.env` file with your Truxe client credentials:

```
TRUXE_URL=http://localhost:3001
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=a-very-strong-and-long-secret-for-session
```

- `TRUXE_URL`: The base URL of your Truxe instance.
- `OAUTH_CLIENT_ID`: The Client ID you obtained from Truxe.
- `OAUTH_CLIENT_SECRET`: The Client Secret you obtained from Truxe.
- `OAUTH_REDIRECT_URI`: The callback URL for your application. This must be registered in Truxe.
- `SESSION_SECRET`: A long, random string for securing sessions.

### 4. Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### 5. OAuth Flow

1.  Navigate to `http://localhost:3000/auth/login`.
2.  You will be redirected to the Truxe consent screen.
3.  Authorize the application.
4.  You will be redirected back to the application at `/auth/callback`.
5.  The application will exchange the authorization code for an access token and redirect you to the protected `/dashboard` page.

## Production Deployment

To run this example in production:

1.  **Build the TypeScript code:**

    ```bash
    npm run build
    ```

2.  **Start the server:**

    ```bash
    npm start
    ```

3.  **Important Considerations:**
    - Ensure `NODE_ENV` is set to `production`.
    - Use a process manager like `pm2` to keep the application running.
    - The session cookie `secure` flag is automatically enabled in production. This requires your application to be served over HTTPS.

## Troubleshooting

- **`invalid_redirect_uri` error**: Ensure the `OAUTH_REDIRECT_URI` in your `.env` file exactly matches the one registered for your client in Truxe.
- **`invalid_client` error**: Double-check your `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`.
- **Session issues**: Make sure the `SESSION_SECRET` is long and unique.
