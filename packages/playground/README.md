# @truxe/playground

Interactive API playground for Truxe authentication endpoints. This package provides a developer-friendly interface to test all Truxe API endpoints without writing code, similar to Swagger UI or Postman but customized for Truxe's authentication flows.

## Features

- **Interactive Request Builder**: Build requests with HTTP methods, headers, body, and query parameters
- **Real-time Response Viewer**: View formatted responses with syntax highlighting
- **Authentication Helpers**: Built-in support for API keys, JWT tokens, and OAuth flows
- **Code Generation**: Generate request snippets in multiple languages (coming soon)
- **Environment Management**: Switch between Local, Staging, and Production environments (coming soon)
- **Guided Workflows**: Step-by-step authentication flows (coming soon)

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Usage

The playground is automatically served at `http://localhost:3003` when running in development mode.

### Endpoint Categories

- **Authentication**: Magic links, password auth, session management
- **Multi-Factor Auth**: TOTP setup and verification
- **OAuth**: Authorization flows and token exchange
- **User Management**: Profile management and user operations
- **Organizations**: Multi-tenant and RBAC features

### Quick Start

1. Select an endpoint from the left sidebar
2. Configure your request in the center panel
3. Add authentication if required
4. Click "Send" to execute the request
5. View the response in the right panel

## Architecture

- **React 18** + **TypeScript** for the UI
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Monaco Editor** for code editing
- **Zustand** for state management

## Integration

The playground integrates with:
- Truxe API endpoints via OpenAPI specification
- Documentation site for "Try it" buttons
- Environment configuration for different deployments

## License

MIT