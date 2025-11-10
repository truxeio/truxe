# Contributing to Truxe

Thank you for your interest in contributing to Truxe! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/truxe.git
   cd truxe
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/truxeio/truxe.git
   ```
4. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Setup

Truxe is a monorepo managed with pnpm workspaces and Turborepo.

### Prerequisites

- Node.js 18+ (or 20+ recommended)
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp apps/api/.env.example apps/api/.env

# Generate JWT keys
pnpm --filter @truxe/api generate-keys

# Start database services
docker-compose up -d postgres redis

# Run database migrations
pnpm --filter @truxe/api db:migrate

# Start development servers
pnpm dev
```

The API will be available at `http://localhost:87001`

---

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-saml-support`
- `fix/oauth-redirect-bug`
- `docs/update-quick-start`
- `refactor/session-management`

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add SAML 2.0 support
fix: resolve OAuth redirect loop
docs: update self-hosting guide
refactor: simplify session validation
test: add MFA integration tests
chore: update dependencies
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

---

## Submitting a Pull Request

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run tests**:
   ```bash
   pnpm test
   ```

3. **Run linter**:
   ```bash
   pnpm lint
   ```

4. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** on GitHub with:
   - Clear title and description
   - Link to related issue (if applicable)
   - Screenshots/GIFs for UI changes
   - Updated tests and documentation

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass (`pnpm test`)
- [ ] New features have tests
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or clearly documented)
- [ ] Commit messages follow Conventional Commits

---

## Coding Standards

### JavaScript/TypeScript

- Use **ESLint** and **Prettier** (configured in the repo)
- Prefer **async/await** over callbacks
- Use **destructuring** where appropriate
- Add **JSDoc comments** for public APIs
- Keep functions **small and focused**

### File Structure

```
apps/api/src/
├── routes/           # API endpoints
├── services/         # Business logic
├── middleware/       # Express middleware
├── utils/            # Utility functions
├── config/           # Configuration
└── tests/            # Test files
```

### Example Code Style

```javascript
/**
 * Validates a user's MFA token
 * @param {string} userId - The user's ID
 * @param {string} token - The TOTP token
 * @returns {Promise<boolean>} True if token is valid
 */
async function validateMfaToken(userId, token) {
  const user = await db.query('SELECT mfa_secret FROM users WHERE id = $1', [userId]);

  if (!user) {
    throw new Error('User not found');
  }

  return speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}
```

---

## Testing

We use **Jest** for unit/integration tests and **K6** for load testing.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test auth.test.js

# Run load tests
pnpm test:load
```

### Writing Tests

```javascript
describe('MFA Authentication', () => {
  let userId;
  let mfaSecret;

  beforeEach(async () => {
    // Setup test user
    userId = await createTestUser();
    mfaSecret = await enableMfa(userId);
  });

  afterEach(async () => {
    // Cleanup
    await deleteTestUser(userId);
  });

  it('should validate correct TOTP token', async () => {
    const token = generateTotp(mfaSecret);
    const result = await validateMfaToken(userId, token);
    expect(result).toBe(true);
  });

  it('should reject invalid TOTP token', async () => {
    const result = await validateMfaToken(userId, '000000');
    expect(result).toBe(false);
  });
});
```

---

## Documentation

### Code Documentation

- Add JSDoc comments to all public functions
- Include usage examples for complex APIs
- Document edge cases and error handling

### User Documentation

Documentation lives in `docs/` and on the website.

**To update docs:**

```bash
# Edit markdown files in docs/
cd docs/

# Preview changes locally
pnpm --filter @truxe/website dev
```

---

## Questions?

- **Discord**: [Join our community](https://discord.gg/truxe)
- **GitHub Discussions**: [Ask questions](https://github.com/truxeio/truxe/discussions)
- **Email**: [contact@truxe.io](mailto:contact@truxe.io)

---

Thank you for contributing to Truxe!
