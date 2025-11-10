# Truxe Manual Setup Guide (Without Dashboard)

This guide shows you how to use Truxe in your own projects **without the developer dashboard** (which will be built in v0.3).

## Prerequisites

- ✅ Truxe deployed and running at `https://api.truxe.io`
- ✅ Database access (PostgreSQL)
- ✅ Your SaaS project (e.g., MyApp)

---

## Step 1: Create Tenant via Database

Connect to your Truxe PostgreSQL database:

```bash
# SSH to your VPS
ssh deployer@your-vps-ip

# Connect to database container
docker exec -it $(docker ps -q -f name=database) psql -U truxe -d truxe
```

Run this SQL to create a tenant for your app:

```sql
-- Create tenant
INSERT INTO tenants (
  id,
  name,
  domain,
  plan,
  status,
  settings,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'My SaaS App',
  'myapp.com',
  'pro',
  'active',
  jsonb_build_object(
    'webhook_url', 'https://myapp.com/api/webhooks/truxe',
    'webhook_secret', encode(gen_random_bytes(32), 'hex'),
    'allowed_origins', ARRAY['https://myapp.com', 'https://www.myapp.com'],
    'magic_link_ttl', 900,
    'session_ttl', 2592000,
    'max_sessions_per_user', 10
  ),
  NOW(),
  NOW()
) RETURNING
  id as tenant_id,
  name,
  settings->>'webhook_secret' as webhook_secret;
```

**Save the output:**
- `tenant_id`: e.g., `123e4567-e89b-12d3-a456-426614174000`
- `webhook_secret`: e.g., `a1b2c3d4...`

---

## Step 2: Generate API Key

Using the `tenant_id` from Step 1:

```sql
-- Generate API key
WITH new_key AS (
  INSERT INTO api_keys (
    id,
    tenant_id,
    name,
    key_hash,
    key_prefix,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '123e4567-e89b-12d3-a456-426614174000'::uuid,  -- YOUR TENANT ID
    'Production API Key',
    encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'),
    'hmdl_sk_live_',
    NOW() + INTERVAL '1 year',
    NOW(),
    NOW()
  ) RETURNING id, key_prefix, tenant_id
)
SELECT
  key_prefix || encode(gen_random_bytes(32), 'hex') as api_key,
  tenant_id
FROM new_key;
```

**Save the output:**
- `api_key`: e.g., `hmdl_sk_live_a1b2c3d4e5f6...`

---

## Step 3: Configure Your SaaS Project

### Environment Variables

```bash
# Your project .env
TRUXE_API_URL=https://api.truxe.io
TRUXE_TENANT_ID=123e4567-e89b-12d3-a456-426614174000
TRUXE_API_KEY=hmdl_sk_live_a1b2c3d4e5f6...
TRUXE_WEBHOOK_SECRET=a1b2c3d4...
```

### Install HTTP Client

```bash
# Your project
npm install axios
# or
pip install httpx
```

---

## Step 4: Implement Authentication

### 4.1 Send Magic Link

**JavaScript/TypeScript:**
```typescript
// lib/auth.ts
import axios from 'axios';

const truxe = axios.create({
  baseURL: process.env.TRUXE_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-ID': process.env.TRUXE_TENANT_ID,
    'Authorization': `Bearer ${process.env.TRUXE_API_KEY}`
  }
});

export async function sendMagicLink(email: string) {
  const response = await truxe.post('/api/v1/auth/magic-link', {
    email,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
  });

  return response.data;
}
```

**Python:**
```python
import httpx
import os

TRUXE_API_URL = os.getenv('TRUXE_API_URL')
TRUXE_TENANT_ID = os.getenv('TRUXE_TENANT_ID')
TRUXE_API_KEY = os.getenv('TRUXE_API_KEY')

async def send_magic_link(email: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{TRUXE_API_URL}/api/v1/auth/magic-link",
            json={
                "email": email,
                "redirect_url": f"{os.getenv('APP_URL')}/auth/callback"
            },
            headers={
                "Content-Type": "application/json",
                "X-Tenant-ID": TRUXE_TENANT_ID,
                "Authorization": f"Bearer {TRUXE_API_KEY}"
            }
        )
        return response.json()
```

### 4.2 Verify Token (Callback Handler)

**JavaScript/TypeScript:**
```typescript
// app/api/auth/callback/route.ts
import { NextRequest } from 'next/server';
import { truxe } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return Response.redirect('/login?error=missing_token');
  }

  try {
    const response = await truxe.post('/api/v1/auth/verify', { token });
    const { access_token, refresh_token, user } = response.data;

    // Set session cookie
    const res = Response.redirect('/dashboard');
    res.cookies.set('auth_token', access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return res;
  } catch (error) {
    return Response.redirect('/login?error=invalid_token');
  }
}
```

**Python (FastAPI):**
```python
from fastapi import FastAPI, Request, Response
from fastapi.responses import RedirectResponse

@app.get("/auth/callback")
async def auth_callback(request: Request, token: str = None):
    if not token:
        return RedirectResponse("/login?error=missing_token")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TRUXE_API_URL}/api/v1/auth/verify",
                json={"token": token},
                headers={
                    "X-Tenant-ID": TRUXE_TENANT_ID
                }
            )
            data = response.json()

        # Set session cookie
        res = RedirectResponse("/dashboard")
        res.set_cookie(
            "auth_token",
            data["access_token"],
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30
        )
        return res
    except Exception:
        return RedirectResponse("/login?error=invalid_token")
```

### 4.3 Validate Token (Middleware)

**JavaScript/TypeScript:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { truxe } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const response = await truxe.post('/api/v1/auth/validate', { token });
    const { user } = response.data;

    // Add user to request headers
    const res = NextResponse.next();
    res.headers.set('x-user-id', user.id);
    res.headers.set('x-user-email', user.email);

    return res;
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*']
};
```

**Python (FastAPI):**
```python
from fastapi import Depends, HTTPException, Cookie
from typing import Optional

async def get_current_user(auth_token: Optional[str] = Cookie(None)):
    if not auth_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TRUXE_API_URL}/api/v1/auth/validate",
                json={"token": auth_token},
                headers={"X-Tenant-ID": TRUXE_TENANT_ID}
            )
            data = response.json()
            return data["user"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# Use in protected routes
@app.get("/dashboard")
async def dashboard(user = Depends(get_current_user)):
    return {"message": f"Welcome {user['email']}"}
```

---

## Step 5: Webhook Handler (Optional but Recommended)

### 5.1 Verify Webhook Signature

**JavaScript/TypeScript:**
```typescript
// app/api/webhooks/truxe/route.ts
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(req: Request) {
  const signature = req.headers.get('x-truxe-signature');
  const payload = await req.text();

  if (!signature || !verifyWebhookSignature(
    payload,
    signature,
    process.env.TRUXE_WEBHOOK_SECRET!
  )) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case 'user.created':
      // Sync user to your database
      await createUserInDatabase(event.data.user);
      break;

    case 'user.logged_in':
      // Track login analytics
      await trackLogin(event.data.user, event.data.session);
      break;

    case 'session.revoked':
      // Invalidate local sessions
      await revokeLocalSession(event.data.session_id);
      break;
  }

  return Response.json({ received: true });
}
```

**Python (FastAPI):**
```python
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.post("/api/webhooks/truxe")
async def truxe_webhook(request: Request):
    signature = request.headers.get("x-truxe-signature")
    payload = await request.body()

    if not signature or not verify_webhook_signature(
        payload,
        signature,
        TRUXE_WEBHOOK_SECRET
    ):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event = await request.json()

    if event["type"] == "user.created":
        # Sync user to database
        await create_user_in_database(event["data"]["user"])
    elif event["type"] == "user.logged_in":
        # Track login
        await track_login(event["data"]["user"], event["data"]["session"])
    elif event["type"] == "session.revoked":
        # Revoke session
        await revoke_local_session(event["data"]["session_id"])

    return {"received": True}
```

---

## Step 6: Test Your Integration

### 6.1 Test Magic Link Flow

```bash
# Send magic link
curl -X POST https://api.truxe.io/api/v1/auth/magic-link \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "email": "test@example.com",
    "redirect_url": "https://myapp.com/auth/callback"
  }'

# Check email for magic link
# Click link → Should redirect to your callback with token
```

### 6.2 Test Token Validation

```bash
# Validate token
curl -X POST https://api.truxe.io/api/v1/auth/validate \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -d '{
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'

# Should return user info and session
```

---

## Step 7: Monitor & Manage

### View Users for Your Tenant

```sql
SELECT
  u.id,
  u.email,
  u.email_verified,
  u.created_at,
  u.last_login_at,
  COUNT(DISTINCT s.id) as active_sessions
FROM users u
LEFT JOIN sessions s ON s.user_id = u.id AND s.revoked_at IS NULL
WHERE u.tenant_id = 'YOUR_TENANT_ID'::uuid
GROUP BY u.id
ORDER BY u.created_at DESC;
```

### View Active Sessions

```sql
SELECT
  s.id,
  s.user_id,
  u.email,
  s.ip_address,
  s.user_agent,
  s.created_at,
  s.last_activity_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE u.tenant_id = 'YOUR_TENANT_ID'::uuid
  AND s.revoked_at IS NULL
ORDER BY s.last_activity_at DESC;
```

### Revoke Session (Force Logout)

```sql
UPDATE sessions
SET
  revoked_at = NOW(),
  updated_at = NOW()
WHERE id = 'SESSION_ID_HERE'::uuid;
```

---

## API Reference (Quick)

### POST `/api/v1/auth/magic-link`
Send magic link email to user.

**Headers:**
- `X-Tenant-ID`: Your tenant ID
- `Authorization`: Bearer YOUR_API_KEY

**Body:**
```json
{
  "email": "user@example.com",
  "redirect_url": "https://yourapp.com/auth/callback"
}
```

### POST `/api/v1/auth/verify`
Verify magic link token and get access token.

**Headers:**
- `X-Tenant-ID`: Your tenant ID

**Body:**
```json
{
  "token": "magic_link_token_from_email"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "email_verified": true
  }
}
```

### POST `/api/v1/auth/validate`
Validate access token.

**Headers:**
- `X-Tenant-ID`: Your tenant ID

**Body:**
```json
{
  "token": "access_token"
}
```

**Response:**
```json
{
  "valid": true,
  "user": { ... },
  "session": { ... }
}
```

### POST `/api/v1/auth/refresh`
Refresh access token using refresh token.

**Headers:**
- `X-Tenant-ID`: Your tenant ID

**Body:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

---

## Troubleshooting

### "Tenant not found"
- Check your `TRUXE_TENANT_ID` is correct
- Verify tenant exists: `SELECT * FROM tenants WHERE id = 'YOUR_ID'::uuid;`

### "Invalid API key"
- Regenerate API key using Step 2
- Check `TRUXE_API_KEY` in your .env

### "Webhook signature invalid"
- Verify `TRUXE_WEBHOOK_SECRET` matches database
- Check signature verification logic

### "Email not sent"
- Check Brevo API key is set in Truxe
- Verify `EMAIL_FROM` domain is verified in Brevo
- Check Truxe logs: `docker logs $(docker ps -q -f name=api)`

---

## Next Steps

Once dashboard is ready (v0.3), you can migrate to using the UI for:
- Creating tenants
- Managing API keys
- Viewing analytics
- Configuring webhooks
- Managing users

For now, this manual approach works perfectly! 🚀
