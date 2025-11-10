### MFA (TOTP) Setup Guide

This guide shows how to enable Two-Factor Authentication (TOTP) in Truxe.

Prerequisites:
- Logged-in user account
- An authenticator app (Google Authenticator, Authy, 1Password, Microsoft Authenticator)

Steps:
1. Open Settings → Security → Enable Two-Factor Authentication.
2. Scan the QR code with your authenticator app (or enter the manual code).
3. Enter the 6-digit code and click Verify.
4. Save your backup codes in a secure location.

Recovery:
- If you lose access to your authenticator, use a single-use backup code.
- You can regenerate backup codes anytime (requires a valid TOTP code).
- To disable MFA, verify with TOTP or a backup code and then disable.

API Endpoints:
- POST `/auth/mfa/setup` → returns `secret`, `qrCode`, `otpauthUrl`, `manualEntryCode`
- POST `/auth/mfa/enable` → body: `{ token }` → returns backup codes
- GET `/auth/mfa/status` → returns `enabled`, `backupCodesRemaining`
- POST `/auth/mfa/disable` → body: `{ token? , backupCode? }`
- POST `/auth/mfa/backup/regenerate` → body: `{ token }` → returns backup codes
- POST `/auth/mfa/challenge/verify` → body: `{ challengeId, token? , backupCode? }` → issues tokens

Security Notes:
- Secrets are encrypted at rest using AES-GCM.
- Backup codes are hashed with argon2id and are single-use.
- Verification attempts are rate limited.


