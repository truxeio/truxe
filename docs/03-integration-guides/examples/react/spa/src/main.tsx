/**
 * Application Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeOAuthClient } from './lib/oauth-client';

// Initialize OAuth client with configuration
initializeOAuthClient({
  heimdallUrl: import.meta.env.VITE_HEIMDALL_URL || 'https://api.heimdall.io',
  clientId: import.meta.env.VITE_OAUTH_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || 'http://localhost:5173/callback',
  scopes: ['openid', 'profile', 'email']
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);