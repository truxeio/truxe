# Security Policy

## Reporting a Vulnerability

The Truxe team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, use **[GitHub Security Advisories](https://github.com/truxeio/truxe/security/advisories/new)** or contact the maintainer privately with:

1. **Description** - Clear explanation of the vulnerability
2. **Impact** - What an attacker could do with this vulnerability
3. **Steps to Reproduce** - Detailed steps to reproduce the issue
4. **Proof of Concept** - Code, screenshots, or video (if applicable)
5. **Suggested Fix** - Your ideas for fixing it (optional)

### What to Expect

- **24-hour response** - We'll acknowledge your report within 24 hours
- **Regular updates** - We'll keep you informed as we investigate
- **Credit** - We'll credit you in our security advisories (if you wish)
- **No legal action** - We won't pursue legal action for good-faith security research

### Our Commitment

- We'll work with you to understand and validate the issue
- We'll keep you updated on our progress
- We'll credit you in our release notes (unless you prefer anonymity)
- We'll aim to patch critical issues within 7 days

---

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | ✅ Yes             |
| 0.3.x   | ✅ Yes             |
| < 0.3   | ❌ No              |

---

## Security Best Practices

### Self-Hosting

If you're self-hosting Truxe, follow these security practices:

#### 1. Environment Variables

**Never commit secrets to version control:**

```bash
# Generate strong secrets
openssl rand -hex 32  # For COOKIE_SECRET, SESSION_SECRET, etc.

# Generate JWT keys
npm run generate-keys
```

#### 2. Database Security

- Use strong PostgreSQL passwords
- Enable SSL/TLS connections
- Restrict database access to trusted IPs
- Regular backups with encryption

#### 3. Redis Security

- Use `requirepass` for authentication
- Bind Redis to localhost or private network
- Disable dangerous commands in production

#### 4. Network Security

- Use HTTPS in production (with valid TLS certificates)
- Configure firewall rules (allow only 80/443)
- Enable rate limiting on API endpoints
- Use DDoS protection (Cloudflare, etc.)

#### 5. Application Security

- Keep Truxe updated to the latest version
- Review security advisories regularly
- Enable audit logging
- Monitor for suspicious activity

---

## Security Features in Truxe

Truxe includes built-in security features:

### Authentication Security

- **Password Hashing** - bcrypt with salt rounds
- **JWT Validation** - RS256 signatures, expiration checks
- **Session Management** - Secure cookies, CSRF protection
- **MFA Support** - TOTP-based two-factor authentication
- **Rate Limiting** - Prevent brute-force attacks

### Authorization Security

- **RBAC** - Role-based access control
- **JWT Revocation** - JTI-based token blacklisting
- **Refresh Token Rotation** - Automatic rotation on refresh

### Infrastructure Security

- **SQL Injection Prevention** - Parameterized queries
- **XSS Protection** - Input sanitization, CSP headers
- **CORS Configuration** - Whitelist allowed origins
- **Security Headers** - Helmet.js integration
- **Audit Logging** - Track all authentication events

---

## Known Security Considerations

### OAuth Token Storage

OAuth tokens are encrypted at rest using `OAUTH_TOKEN_ENCRYPTION_KEY`. Ensure this key is:
- At least 32 bytes (256 bits)
- Generated with a cryptographically secure random generator
- Rotated periodically (we recommend every 90 days)

### JWT Private Keys

JWT private keys are base64-encoded RSA keys. Protect them like passwords:
- Never commit to version control
- Store in secure vaults (AWS Secrets Manager, etc.)
- Rotate keys if compromised (we provide rotation tools)

### Webhook HMAC Secrets

Webhook signatures use HMAC-SHA256. Ensure webhook secrets are:
- Unique per webhook endpoint
- At least 32 bytes
- Validated on the receiving end

---

## Security Disclosure Policy

We follow **Coordinated Vulnerability Disclosure (CVD)**:

1. **Report** - You report a vulnerability privately
2. **Acknowledge** - We acknowledge within 24 hours
3. **Investigate** - We confirm and assess severity (1-7 days)
4. **Fix** - We develop and test a patch (3-30 days)
5. **Release** - We release a security update
6. **Disclose** - We publish a security advisory (after patch)

### Severity Levels

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **Critical** | 1-3 days | Authentication bypass, RCE |
| **High** | 3-7 days | SQL injection, stored XSS |
| **Medium** | 7-14 days | CSRF, information disclosure |
| **Low** | 14-30 days | Rate limit bypass, minor leaks |

---

## Hall of Fame

We recognize security researchers who help keep Truxe secure:

<!-- Will be updated as we receive reports -->

*No reports yet - be the first!*

---

## Questions?

For general security questions (not vulnerabilities), you can:

- GitHub Discussions: [Ask publicly](https://github.com/truxeio/truxe/discussions)
- GitHub Issues: [General questions](https://github.com/truxeio/truxe/issues)

---

**Thank you for helping keep Truxe and our users safe!**
