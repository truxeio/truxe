# OAuth Client Service - Quick Reference

## 📖 API Reference

### Import

```javascript
import clientService from './src/services/oauth-provider/client-service.js';
```

---

## 🔧 Methods

### Client Registration

#### `registerClient(params)` 
Register a new OAuth 2.0 client application.

**Parameters:**
```javascript
{
  clientName: string,           // Required: 1-255 chars
  redirectUris: string[],       // Required: Array of valid HTTPS/HTTP URLs
  createdBy: UUID,              // Required: User ID who created the client
  tenantId?: UUID,              // Optional: Tenant/organization ID
  allowedScopes?: string[],     // Default: ['openid', 'email', 'profile']
  requirePkce?: boolean,        // Default: true
  requireConsent?: boolean,     // Default: true
  trusted?: boolean,            // Default: false
  clientUri?: string,           // Optional: Client homepage URL
  logoUri?: string,             // Optional: Client logo URL
  tosUri?: string,              // Optional: Terms of service URL
  policyUri?: string            // Optional: Privacy policy URL
}
```

**Returns:**
```javascript
{
  id: UUID,
  client_id: 'cl_xxxxxxxxxxxxx',     // 19 chars total
  client_secret: 'cs_xxxxxxxxxxxxx', // 35 chars total - SAVE THIS!
  client_name: string,
  redirect_uris: string[],
  allowed_scopes: string[],
  // ... other fields
}
```

**Example:**
```javascript
const client = await clientService.registerClient({
  clientName: 'My App',
  redirectUris: ['https://myapp.com/callback'],
  createdBy: '550e8400-e29b-41d4-a716-446655440000'
});

// IMPORTANT: Save client_secret - it's only shown once!
console.log('Client ID:', client.client_id);
console.log('Client Secret:', client.client_secret);
```

---

### Client Validation

#### `validateClientCredentials(clientId, clientSecret)`
Validate OAuth client credentials.

**Parameters:**
- `clientId`: string - Client ID (format: cl_xxxxxxxxxxxxx)
- `clientSecret`: string - Plain text client secret (format: cs_xxxxxxxxxxxxx)

**Returns:**
- `Object` - Client object if valid
- `null` - If credentials invalid or client suspended/revoked

**Example:**
```javascript
const client = await clientService.validateClientCredentials(
  'cl_a1b2c3d4e5f6g7h8',
  'cs_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5'
);

if (client) {
  console.log('✅ Valid client:', client.client_name);
} else {
  console.log('❌ Invalid credentials');
}
```

---

#### `validateRedirectUri(clientId, redirectUri)`
Validate if a redirect URI is whitelisted for the client.

**Parameters:**
- `clientId`: string - Client ID
- `redirectUri`: string - Redirect URI to validate

**Returns:**
- `boolean` - true if valid, false otherwise

**Example:**
```javascript
const isValid = await clientService.validateRedirectUri(
  'cl_a1b2c3d4e5f6g7h8',
  'https://myapp.com/callback'
);

if (isValid) {
  console.log('✅ Redirect URI allowed');
} else {
  console.log('❌ Redirect URI not whitelisted');
}
```

---

### Client Retrieval

#### `getClientById(clientId)`
Get OAuth client by ID.

**Parameters:**
- `clientId`: string - Client ID

**Returns:**
- `Object` - Client object (without client_secret_hash)
- `null` - If client not found

**Example:**
```javascript
const client = await clientService.getClientById('cl_a1b2c3d4e5f6g7h8');
console.log(client.client_name);
console.log(client.redirect_uris);
```

---

#### `listClients(tenantId, options)`
List OAuth clients for a tenant.

**Parameters:**
- `tenantId`: UUID - Tenant ID
- `options`: Object (optional)
  - `limit`: number - Max results (default: 50)
  - `offset`: number - Offset for pagination (default: 0)

**Returns:**
- `Array<Object>` - Array of client objects

**Example:**
```javascript
// Get first 50 clients
const clients = await clientService.listClients(tenantId);

// Paginate through clients
const page1 = await clientService.listClients(tenantId, { limit: 10, offset: 0 });
const page2 = await clientService.listClients(tenantId, { limit: 10, offset: 10 });
```

---

### Client Management

#### `updateClient(clientId, updates)`
Update OAuth client metadata.

**Parameters:**
- `clientId`: string - Client ID
- `updates`: Object - Fields to update
  - `clientName`: string
  - `redirectUris`: string[]
  - `allowedScopes`: string[]
  - `requirePkce`: boolean
  - `requireConsent`: boolean
  - `clientUri`: string
  - `logoUri`: string
  - `tosUri`: string
  - `policyUri`: string

**Returns:**
- `Object` - Updated client object

**Example:**
```javascript
const updated = await clientService.updateClient('cl_a1b2c3d4e5f6g7h8', {
  clientName: 'My App (Updated)',
  redirectUris: [
    'https://myapp.com/callback',
    'https://myapp.com/oauth/callback'
  ]
});
```

---

#### `regenerateClientSecret(clientId)`
Regenerate client secret (invalidates old secret).

**Parameters:**
- `clientId`: string - Client ID

**Returns:**
```javascript
{
  client_id: 'cl_xxxxxxxxxxxxx',
  client_secret: 'cs_xxxxxxxxxxxxx' // NEW SECRET - SAVE THIS!
}
```

**Example:**
```javascript
const newSecret = await clientService.regenerateClientSecret('cl_a1b2c3d4e5f6g7h8');

console.log('New secret:', newSecret.client_secret);
// IMPORTANT: Old secret is now invalid!
```

---

#### `suspendClient(clientId)`
Temporarily suspend client (revoke access).

**Returns:** void

**Example:**
```javascript
await clientService.suspendClient('cl_a1b2c3d4e5f6g7h8');
console.log('Client suspended - cannot authenticate');
```

---

#### `activateClient(clientId)`
Activate suspended client.

**Returns:** void

**Example:**
```javascript
await clientService.activateClient('cl_a1b2c3d4e5f6g7h8');
console.log('Client activated - can authenticate again');
```

---

#### `revokeClient(clientId)`
Permanently revoke client.

**Returns:** void

**Example:**
```javascript
await clientService.revokeClient('cl_a1b2c3d4e5f6g7h8');
console.log('Client permanently revoked');
```

---

#### `deleteClient(clientId)`
Hard delete client (cascade deletes all related data).

**Returns:** void

**Example:**
```javascript
await clientService.deleteClient('cl_a1b2c3d4e5f6g7h8');
console.log('Client permanently deleted');
```

---

### Utility Methods

#### `generateClientId()`
Generate new client ID.

**Returns:** string - Format: `cl_xxxxxxxxxxxxx`

**Example:**
```javascript
const clientId = clientService.generateClientId();
console.log(clientId); // cl_a1b2c3d4e5f6g7h8
```

---

#### `generateClientSecret()`
Generate new client secret.

**Returns:** string - Format: `cs_xxxxxxxxxxxxx`

**Example:**
```javascript
const clientSecret = clientService.generateClientSecret();
console.log(clientSecret); // cs_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5
```

---

#### `hashClientSecret(clientSecret)`
Hash client secret with bcrypt.

**Parameters:**
- `clientSecret`: string - Plain text secret

**Returns:** Promise<string> - Bcrypt hash

**Example:**
```javascript
const hash = await clientService.hashClientSecret('cs_plaintext');
console.log(hash); // $2b$12$...
```

---

#### `validateClientIdFormat(clientId)`
Validate client ID format.

**Parameters:**
- `clientId`: string - Client ID to validate

**Returns:** boolean

**Example:**
```javascript
const isValid = clientService.validateClientIdFormat('cl_a1b2c3d4e5f6g7h8');
console.log(isValid); // true

const isInvalid = clientService.validateClientIdFormat('invalid');
console.log(isInvalid); // false
```

---

#### `validateClientSecretFormat(clientSecret)`
Validate client secret format.

**Parameters:**
- `clientSecret`: string - Client secret to validate

**Returns:** boolean

**Example:**
```javascript
const isValid = clientService.validateClientSecretFormat('cs_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5');
console.log(isValid); // true
```

---

## 🔒 Security Best Practices

### DO ✅

1. **Store secrets securely:**
   ```javascript
   // ✅ Good: Save secret immediately after registration
   const client = await clientService.registerClient({ ... });
   await saveToSecureVault(client.client_secret);
   ```

2. **Never log secrets:**
   ```javascript
   // ✅ Good: Log without secret
   console.log('Client registered:', client.client_id);
   
   // ❌ Bad: Don't log secret
   // console.log('Secret:', client.client_secret);
   ```

3. **Validate all inputs:**
   ```javascript
   // ✅ Good: Service validates automatically
   await clientService.registerClient({
     clientName: 'Valid Name',
     redirectUris: ['https://valid.com/callback']
   });
   ```

4. **Use HTTPS redirect URIs in production:**
   ```javascript
   // ✅ Good for production
   redirectUris: ['https://app.com/callback']
   
   // ⚠️ Only for development
   redirectUris: ['http://localhost:3000/callback']
   ```

### DON'T ❌

1. **Never return secrets in API responses:**
   ```javascript
   // ❌ Bad
   return { ...client, client_secret: secret };
   
   // ✅ Good: Service handles this automatically
   return client; // secret already excluded
   ```

2. **Never store plain text secrets:**
   ```javascript
   // ❌ Bad
   await db.query('INSERT INTO oauth_clients (secret) VALUES ($1)', [plainSecret]);
   
   // ✅ Good: Service hashes automatically
   await clientService.registerClient({ ... });
   ```

3. **Never allow javascript: URIs:**
   ```javascript
   // ❌ Bad
   redirectUris: ['javascript:alert(1)']
   
   // ✅ Service automatically rejects this
   ```

---

## 🐛 Error Handling

```javascript
try {
  const client = await clientService.registerClient({
    clientName: 'My App',
    redirectUris: ['https://app.com/callback'],
    createdBy: userId
  });
} catch (error) {
  if (error.message.includes('Client name is required')) {
    // Handle validation error
  } else if (error.message.includes('At least one redirect URI')) {
    // Handle missing URIs
  } else if (error.message.includes('Invalid redirect URI')) {
    // Handle invalid URI
  } else {
    // Handle database error
  }
}
```

---

## 📊 Common Patterns

### Full Registration Flow

```javascript
// 1. Register client
const client = await clientService.registerClient({
  clientName: 'My Application',
  redirectUris: ['https://myapp.com/callback'],
  createdBy: userId,
  tenantId: tenantId
});

// 2. Store secret securely (only shown once!)
await vault.store(client.client_id, client.client_secret);

// 3. Return only client_id to user
return {
  client_id: client.client_id,
  client_name: client.client_name,
  redirect_uris: client.redirect_uris
};
```

### Authentication Flow

```javascript
// 1. Receive credentials from client
const { client_id, client_secret } = req.body;

// 2. Validate credentials
const client = await clientService.validateClientCredentials(
  client_id,
  client_secret
);

// 3. Check result
if (!client) {
  return res.status(401).json({ error: 'Invalid client credentials' });
}

// 4. Validate redirect URI
const isValidUri = await clientService.validateRedirectUri(
  client_id,
  req.body.redirect_uri
);

if (!isValidUri) {
  return res.status(400).json({ error: 'Invalid redirect_uri' });
}

// 5. Continue with OAuth flow...
```

---

## 🧪 Testing

### Unit Test Example

```javascript
import clientService from './client-service.js';

describe('OAuth Client Service', () => {
  it('should register and validate client', async () => {
    // Register
    const client = await clientService.registerClient({
      clientName: 'Test App',
      redirectUris: ['https://test.com/callback'],
      createdBy: userId
    });

    // Validate
    const validated = await clientService.validateClientCredentials(
      client.client_id,
      client.client_secret
    );

    expect(validated).toBeTruthy();
    expect(validated.client_name).toBe('Test App');
  });
});
```

---

## 📝 Database Schema

```sql
CREATE TABLE oauth_clients (
  id UUID PRIMARY KEY,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  client_secret_hash VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  allowed_scopes TEXT[],
  require_pkce BOOLEAN DEFAULT true,
  require_consent BOOLEAN DEFAULT true,
  trusted BOOLEAN DEFAULT false,
  tenant_id UUID REFERENCES tenants(id),
  created_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);
```

---

_Last updated: November 4, 2025_
