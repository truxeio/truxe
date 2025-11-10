# Migrating from Clerk to Truxe

This guide helps you migrate your application from Clerk to Truxe with minimal downtime and maximum data preservation.

## 🎯 Migration Overview

### What Gets Migrated
- ✅ **User accounts** (email, verification status, metadata)
- ✅ **Organizations** (if using Clerk Organizations)
- ✅ **User-organization memberships** and roles
- ✅ **User metadata** and custom fields
- ✅ **Session configuration** and security settings

### What Doesn't Get Migrated
- ❌ **Passwords** (Truxe is passwordless-first)
- ❌ **Social login connections** (will be re-established)
- ❌ **Webhooks** (need to be reconfigured)
- ❌ **Custom JWT claims** (will be mapped to Truxe format)

---

## 🚀 Quick Migration (Automated)

### 1. Install Truxe CLI
```bash
npm install -g @truxe/cli
```

### 2. Export Clerk Data
You have two options for exporting Clerk data:

#### Option A: Use Clerk API (Recommended)
```bash
# Export directly from Clerk using API key
truxe migrate from-clerk --api-key=sk_live_your_clerk_api_key

# This will automatically export and save data to clerk-export-[timestamp].json
```

#### Option B: Manual Export
```bash
# If you have already exported Clerk data manually
truxe migrate from-clerk --data=./clerk-users.json
```

### 3. Validate Migration Data (Optional but Recommended)
```bash
# Validate your Clerk data before migration
truxe migrate validate --source=clerk --data=./clerk-export-[timestamp].json
```

### 4. Perform Dry Run Migration
```bash
# Test the migration without making changes
truxe migrate from-clerk --data=./clerk-export-[timestamp].json --dry-run
```

### 5. Run Actual Migration
```bash
# Perform the actual migration
truxe migrate from-clerk --data=./clerk-export-[timestamp].json --batch-size=50

# Monitor migration progress
truxe migrate status --migration-id=clerk_[timestamp]_[id]
```

### 6. Validate Migration Results
```bash
# Check migration integrity
truxe migrate validate --source=clerk --data=./clerk-export-[timestamp].json

# View migration status and results
truxe migrate status --migration-id=clerk_[timestamp]_[id]
```

### 7. Update Your Code
```bash
# Replace Clerk imports with Truxe (coming soon)
# truxe migrate code --from=clerk --path=./src
```

🎉 **Migration complete!** Test your authentication flow and deploy.

### Migration Features

- **Automated Data Export**: Direct export from Clerk API
- **Data Validation**: Comprehensive validation before migration
- **Dry Run Mode**: Test migration without making changes
- **Progress Tracking**: Real-time migration progress with detailed status
- **Batch Processing**: Configurable batch sizes for large datasets
- **Error Handling**: Detailed error reporting and recovery options
- **Rollback Support**: Complete rollback capabilities if needed

### Rollback (if needed)
```bash
# Rollback a migration if something goes wrong
truxe migrate rollback --migration-id=clerk_[timestamp]_[id] --confirm
```

---

## 📋 Manual Migration (Step-by-Step)

If you prefer more control or have complex customizations:

### Step 1: Data Export from Clerk

#### Export Users
```javascript
// scripts/export-clerk-users.js
import { clerkClient } from '@clerk/clerk-sdk-node';

async function exportUsers() {
  const users = await clerkClient.users.getUserList({
    limit: 500 // Adjust based on your user count
  });
  
  const userData = users.map(user => ({
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress,
    emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    metadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt
  }));
  
  await fs.writeFile('./clerk-users.json', JSON.stringify(userData, null, 2));
  console.log(`Exported ${userData.length} users`);
}

exportUsers();
```

#### Export Organizations (if applicable)
```javascript
// scripts/export-clerk-orgs.js
import { clerkClient } from '@clerk/clerk-sdk-node';

async function exportOrganizations() {
  const orgs = await clerkClient.organizations.getOrganizationList({
    limit: 500
  });
  
  const orgData = [];
  
  for (const org of orgs) {
    const memberships = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: org.id
    });
    
    orgData.push({
      id: org.id,
      name: org.name,
      slug: org.slug,
      imageUrl: org.imageUrl,
      metadata: org.publicMetadata,
      createdAt: org.createdAt,
      memberships: memberships.map(m => ({
        userId: m.publicUserData.userId,
        role: m.role,
        createdAt: m.createdAt
      }))
    });
  }
  
  await fs.writeFile('./clerk-orgs.json', JSON.stringify(orgData, null, 2));
  console.log(`Exported ${orgData.length} organizations`);
}

exportOrganizations();
```

### Step 2: Set Up Truxe

#### Initialize Project
```bash
# Create new Truxe project
truxe init my-app --template=nextjs

# Configure for your domain
truxe config set domain=yourapp.com
truxe config set multi-tenant=true  # if using organizations
```

#### Configure Database
```bash
# Set up production database
export DATABASE_URL="postgresql://user:pass@host:5432/truxe"
truxe migrate --env=production
```

### Step 3: Import Data to Truxe

#### Import Users
```javascript
// scripts/import-to-truxe.js
import { TruxeClient } from '@truxe/sdk';

const truxe = new TruxeClient({
  apiKey: process.env.TRUXE_API_KEY,
  baseUrl: 'https://auth.yourapp.com'
});

async function importUsers() {
  const clerkUsers = JSON.parse(await fs.readFile('./clerk-users.json'));
  
  for (const user of clerkUsers) {
    try {
      await truxe.users.create({
        email: user.email,
        emailVerified: user.emailVerified,
        metadata: {
          firstName: user.firstName,
          lastName: user.lastName,
          imageUrl: user.imageUrl,
          ...user.metadata,
          // Store original Clerk ID for reference
          clerkId: user.id
        }
      });
      
      console.log(`Imported user: ${user.email}`);
    } catch (error) {
      console.error(`Failed to import ${user.email}:`, error.message);
    }
  }
}

importUsers();
```

#### Import Organizations
```javascript
async function importOrganizations() {
  const clerkOrgs = JSON.parse(await fs.readFile('./clerk-orgs.json'));
  
  for (const org of clerkOrgs) {
    try {
      // Create organization
      const truxeOrg = await truxe.organizations.create({
        name: org.name,
        slug: org.slug,
        metadata: {
          imageUrl: org.imageUrl,
          ...org.metadata,
          clerkId: org.id
        }
      });
      
      // Import memberships
      for (const membership of org.memberships) {
        const user = await truxe.users.findByMetadata('clerkId', membership.userId);
        if (user) {
          await truxe.organizations.addMember(truxeOrg.id, {
            userId: user.id,
            role: mapClerkRole(membership.role)
          });
        }
      }
      
      console.log(`Imported organization: ${org.name}`);
    } catch (error) {
      console.error(`Failed to import ${org.name}:`, error.message);
    }
  }
}

function mapClerkRole(clerkRole) {
  const roleMap = {
    'admin': 'admin',
    'basic_member': 'member',
    'org:admin': 'admin',
    'org:member': 'member'
  };
  return roleMap[clerkRole] || 'member';
}
```

### Step 4: Update Your Application Code

#### Replace Clerk Hooks
```typescript
// Before (Clerk)
import { useUser, useAuth, useOrganization } from '@clerk/nextjs';

function MyComponent() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { organization } = useOrganization();
  
  return (
    <div>
      <p>Hello {user?.firstName}</p>
      <p>Org: {organization?.name}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

```typescript
// After (Truxe)
import { useUser, useAuth, useOrganization } from '@truxe/react';

function MyComponent() {
  const { user } = useUser();
  const { logout } = useAuth();
  const { organization } = useOrganization();
  
  return (
    <div>
      <p>Hello {user?.metadata?.firstName}</p>
      <p>Org: {organization?.name}</p>
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}
```

#### Replace Authentication Components
```typescript
// Before (Clerk)
import { SignIn, SignUp, UserButton } from '@clerk/nextjs';

export default function AuthPage() {
  return (
    <div>
      <SignIn />
      <SignUp />
      <UserButton />
    </div>
  );
}
```

```typescript
// After (Truxe)
import { LoginForm, SignupForm, UserMenu } from '@truxe/ui';

export default function AuthPage() {
  return (
    <div>
      <LoginForm />
      <SignupForm />
      <UserMenu />
    </div>
  );
}
```

#### Update API Route Protection
```typescript
// Before (Clerk)
import { getAuth } from '@clerk/nextjs/server';

export default async function handler(req, res) {
  const { userId } = getAuth(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Your API logic
}
```

```typescript
// After (Truxe)
import { verifyToken } from '@truxe/nextjs';

export default async function handler(req, res) {
  const user = await verifyToken(req);
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Your API logic (user.id instead of userId)
}
```

### Step 5: Update Environment Variables

```bash
# Remove Clerk variables
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# CLERK_SECRET_KEY=

# Add Truxe variables
NEXT_PUBLIC_TRUXE_URL=https://auth.yourapp.com
TRUXE_API_KEY=your-api-key
```

### Step 6: Update Middleware

```typescript
// Before (Clerk)
import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  publicRoutes: ['/'],
  ignoredRoutes: ['/api/webhook']
});
```

```typescript
// After (Truxe)
import { authMiddleware } from '@truxe/nextjs';

export default authMiddleware({
  publicRoutes: ['/'],
  ignoredRoutes: ['/api/webhook']
});
```

---

## 🔄 Gradual Migration Strategy

For zero-downtime migration with large user bases:

### Phase 1: Dual Authentication (1-2 weeks)
```typescript
// Support both Clerk and Truxe during transition
import { useUser as useClerkUser } from '@clerk/nextjs';
import { useUser as useTruxeUser } from '@truxe/react';

function MyComponent() {
  const clerkUser = useClerkUser();
  const truxeUser = useTruxeUser();
  
  // Use Truxe if available, fallback to Clerk
  const user = truxeUser.user || clerkUser.user;
  
  return <div>Hello {user?.email}</div>;
}
```

### Phase 2: User Migration Prompts
```typescript
// Prompt Clerk users to migrate to Truxe
function MigrationPrompt() {
  const { user: clerkUser } = useClerkUser();
  const { login } = useTruxeAuth();
  
  if (!clerkUser || truxeUser) return null;
  
  return (
    <div className="migration-banner">
      <p>Upgrade your account security!</p>
      <button onClick={() => login({ email: clerkUser.email })}>
        Switch to Passwordless Login
      </button>
    </div>
  );
}
```

### Phase 3: Clerk Deprecation
```typescript
// Gradually disable Clerk features
const CLERK_ENABLED = process.env.ENABLE_CLERK === 'true';

function AuthProvider({ children }) {
  if (CLERK_ENABLED) {
    return (
      <>
        <ClerkProvider>
          <TruxeProvider>
            {children}
          </TruxeProvider>
        </ClerkProvider>
      </>
    );
  }
  
  return <TruxeProvider>{children}</TruxeProvider>;
}
```

---

## 🧪 Testing Your Migration

### 1. Authentication Flow Testing
```bash
# Test magic link flow
truxe test auth --email=test@example.com

# Test organization switching
truxe test org-switch --user=test@example.com --org=acme
```

### 2. Data Integrity Verification
```javascript
// scripts/verify-migration.js
async function verifyMigration() {
  const clerkUsers = JSON.parse(await fs.readFile('./clerk-users.json'));
  const truxeUsers = await truxe.users.list();
  
  console.log(`Clerk users: ${clerkUsers.length}`);
  console.log(`Truxe users: ${truxeUsers.length}`);
  
  // Check for missing users
  const missingUsers = clerkUsers.filter(clerkUser => 
    !truxeUsers.find(hu => hu.metadata?.clerkId === clerkUser.id)
  );
  
  if (missingUsers.length > 0) {
    console.error(`Missing ${missingUsers.length} users:`, missingUsers);
  } else {
    console.log('✅ All users migrated successfully');
  }
}
```

### 3. Performance Testing
```bash
# Load test authentication endpoints
truxe test load --concurrent=100 --duration=60s
```

---

## 🚨 Common Migration Issues

### Issue 1: Email Delivery Problems
```bash
# Test email configuration
truxe test email --to=your-email@example.com

# Check email provider settings
truxe config get email
```

### Issue 2: JWT Token Compatibility
```typescript
// Custom JWT claims mapping
const clerkToTruxeClaims = {
  'org_id': 'org_id',
  'org_role': 'role',
  'org_slug': 'org_slug'
};

function mapJWTClaims(clerkToken) {
  const truxeClaims = {};
  Object.entries(clerkToTruxeClaims).forEach(([clerkClaim, truxeClaim]) => {
    if (clerkToken[clerkClaim]) {
      truxeClaims[truxeClaim] = clerkToken[clerkClaim];
    }
  });
  return truxeClaims;
}
```

### Issue 3: Organization Hierarchy
```typescript
// Handle Clerk's flat organization structure
async function migrateOrganizationHierarchy() {
  // Clerk doesn't support nested orgs, so create flat structure
  const clerkOrgs = await getClerkOrganizations();
  
  for (const org of clerkOrgs) {
    await truxe.organizations.create({
      name: org.name,
      slug: org.slug,
      // No parent_id - flat structure
      metadata: org.metadata
    });
  }
}
```

---

## 💰 Cost Comparison

### Clerk Pricing (Before)
```
Starter: $25/month (up to 10k MAU)
Pro: $99/month (up to 100k MAU)
Enterprise: Custom pricing
```

### Truxe Pricing (After)
```
Free: 1k MAU (perfect for testing migration)
Starter: $19/month (up to 5k MAU)
Pro: $99/month (up to 25k MAU)
Enterprise: Custom pricing
```

**Potential Savings:** 20-40% reduction in authentication costs

---

## 🎯 Post-Migration Checklist

- [ ] All users can authenticate successfully
- [ ] Organization memberships are preserved
- [ ] User metadata is accessible
- [ ] Protected routes work correctly
- [ ] API authentication functions properly
- [ ] Email delivery is working
- [ ] Webhooks are reconfigured (if needed)
- [ ] Performance meets expectations
- [ ] Monitoring and alerts are set up
- [ ] Backup and disaster recovery tested

---

## 🆘 Need Help?

### Migration Support
- **Email:** migration@truxe.io
- **Discord:** [#migration-help](https://discord.gg/truxe)
- **Documentation:** [Migration Troubleshooting](https://docs.truxe.io/migration/troubleshooting)

### Professional Migration Service
For complex migrations or enterprise customers:
- **White-glove migration service** available
- **Dedicated migration engineer** assigned
- **Zero-downtime migration** guaranteed
- **Post-migration support** included

[**Contact Sales →**](mailto:sales@truxe.io?subject=Clerk%20Migration%20Service)

---

**Questions?** Check our [Migration FAQ](./migration-faq.md) or join our [Discord community](https://discord.gg/truxe).
