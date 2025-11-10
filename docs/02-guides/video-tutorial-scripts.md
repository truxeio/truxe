# Video Tutorial Scripts

Professional video tutorial scripts for key Truxe workflows, designed for screen recording with clear narration and step-by-step demonstrations.

## 📹 Video Production Guidelines

### Technical Specifications
- **Resolution**: 1920x1080 (1080p)
- **Frame Rate**: 30 FPS
- **Audio**: 48kHz, stereo
- **Duration**: 5-15 minutes per video
- **Format**: MP4 (H.264)

### Recording Setup
- **Screen Recording**: Clean desktop, hide personal information
- **Code Editor**: VS Code with consistent theme
- **Terminal**: Clean terminal with readable font size
- **Browser**: Chrome with bookmarks hidden
- **Mouse**: Highlight cursor for visibility

---

## 🎬 Tutorial 1: "Getting Started with Truxe in 5 Minutes"

**Duration**: 5-7 minutes  
**Audience**: Developers new to Truxe  
**Goal**: Complete authentication setup from zero to working app

### Script

**[INTRO - 0:00-0:15]**

*[Screen: Clean desktop]*

"Hi, I'm going to show you how to add authentication to your web application using Truxe in just 5 minutes. Truxe is an open-source authentication platform that provides passwordless login, multi-tenant support, and enterprise-grade security."

*[Screen: Show Truxe website/logo]*

"By the end of this tutorial, you'll have a complete authentication system with magic link login, protected routes, and user session management."

**[SETUP - 0:15-1:30]**

*[Screen: Terminal]*

"Let's start by installing the Truxe CLI. I'll open my terminal and run:"

```bash
npm install -g @truxe/cli
```

*[Wait for installation to complete]*

"Great! Now let's verify the installation:"

```bash
truxe --version
```

"Perfect. Now I'll create a new Next.js project with Truxe authentication:"

```bash
truxe init my-auth-app --template=nextjs --yes
```

*[Show CLI output and project creation]*

"The CLI is setting up everything we need - the Next.js application, the authentication API, database configuration, and all the necessary components."

**[CONFIGURATION - 1:30-2:30]**

*[Screen: Navigate to project directory]*

"Let's navigate to our new project:"

```bash
cd my-auth-app
```

"The CLI has created two main parts: our Next.js frontend and the Truxe authentication API. Let's look at the project structure:"

*[Screen: VS Code showing project structure]*

"We have our Next.js app with pre-configured authentication components, and a Truxe API server. The CLI has also created environment files with sensible defaults."

*[Screen: Show .env.local file]*

"For this demo, I'm using the default SQLite database and development email service, so we don't need to configure anything else."

**[STARTING THE SERVICES - 2:30-3:15]**

*[Screen: Terminal split into two panes]*

"Now let's start both services. I'll split my terminal and start the Next.js app first:"

```bash
npm run dev
```

*[Show Next.js starting up]*

"And in the second terminal, I'll start the Truxe API:"

```bash
npm run truxe.io
```

*[Show Truxe API starting up]*

"Excellent! Both services are running. The Next.js app is on port 3000, and the Truxe API is on port 3001."

**[TESTING THE AUTHENTICATION - 3:15-4:45]**

*[Screen: Browser showing localhost:3000]*

"Let's test our authentication. I'll open the browser and go to localhost:3000."

*[Show homepage with login button]*

"Here's our homepage with a login button. Let's click on 'Sign In'."

*[Navigate to login page]*

"This takes us to the login page. I'll enter my email address:"

*[Type: demo@example.com]*

"And click 'Send Magic Link'."

*[Show success message]*

"Perfect! The magic link has been sent. Since we're in development mode, Truxe provides a development inbox. Let me open it at localhost:3001/dev/inbox."

*[Screen: Open new tab to localhost:3001/dev/inbox]*

"Here's the development inbox with our magic link email. I'll click on the magic link."

*[Click the magic link]*

*[Screen: Shows verification page, then redirects to dashboard]*

"Excellent! The magic link worked perfectly. I'm now authenticated and redirected to the dashboard. I can see my email address and account information."

**[EXPLORING THE FEATURES - 4:45-5:30]**

*[Screen: Dashboard showing user information]*

"Let me show you what we've accomplished. We have a complete authentication system with:"

*[Screen: Show different parts of the dashboard]*

"- Passwordless login with magic links
- Automatic session management
- Protected routes that require authentication
- User profile information
- Secure logout functionality"

*[Click logout button]*

"When I logout, I'm redirected back to the homepage and my session is completely cleared."

**[WRAP-UP - 5:30-5:45]**

*[Screen: Back to homepage]*

"And that's it! In just 5 minutes, we've created a complete authentication system. No complex configuration, no security vulnerabilities to worry about, and no vendor lock-in since Truxe is open source."

"Check out the links in the description for more advanced tutorials, documentation, and our GitHub repository. Thanks for watching!"

*[Screen: Show end card with links]*

---

## 🎬 Tutorial 2: "Adding Multi-Tenant Authentication to Your SaaS"

**Duration**: 10-12 minutes  
**Audience**: SaaS developers  
**Goal**: Implement organization-based multi-tenancy

### Script

**[INTRO - 0:00-0:30]**

*[Screen: SaaS dashboard mockup]*

"Building a SaaS application? You need multi-tenant authentication where users can belong to multiple organizations with different roles and permissions. Today I'll show you how to implement this with Truxe in under 10 minutes."

*[Screen: Truxe multi-tenant architecture diagram]*

"We'll build a complete multi-tenant system with organization switching, role-based access control, and tenant data isolation."

**[PROJECT SETUP - 0:30-2:00]**

*[Screen: Terminal]*

"Let's start with a new project configured for multi-tenancy:"

```bash
truxe init saas-app --template=nextjs --multi-tenant=true
cd saas-app
```

*[Show project creation with multi-tenant features]*

"The multi-tenant template includes additional components for organization management, role-based routing, and tenant switching."

*[Screen: VS Code showing enhanced project structure]*

"Notice we now have additional components like OrganizationSwitcher, RoleGuard, and enhanced user management."

**[CONFIGURATION - 2:00-3:00]**

*[Screen: Environment configuration]*

"Let's configure our multi-tenant settings:"

*[Show .env.local with multi-tenant options]*

```bash
ENABLE_MULTI_TENANT=true
DEFAULT_ROLE=member
ALLOW_ORGANIZATION_SIGNUP=true
```

"I'll also set up a PostgreSQL database for proper tenant isolation:"

```bash
# Update database URL
DATABASE_URL=postgresql://localhost:5432/truxe_saas
```

**[DATABASE SETUP - 3:00-3:45]**

*[Screen: Terminal]*

"Let's run the database migrations to set up our multi-tenant schema:"

```bash
npm run db:migrate
```

*[Show migration output with organization tables]*

"The migrations create tables for organizations, memberships, and role-based permissions with Row Level Security policies for complete tenant isolation."

**[STARTING THE APPLICATION - 3:45-4:30]**

*[Screen: Start both services]*

```bash
# Terminal 1
npm run dev

# Terminal 2  
npm run truxe.io
```

*[Show both services starting with multi-tenant features enabled]*

**[CREATING ORGANIZATIONS - 4:30-6:00]**

*[Screen: Browser at localhost:3000]*

"Let's test our multi-tenant setup. I'll sign in with my email:"

*[Go through login flow]*

"After login, since this is my first time, I'm prompted to create an organization:"

*[Screen: Organization creation form]*

"I'll create 'Acme Corp' with the slug 'acme-corp':"

*[Fill out organization form]*

"Perfect! I'm now the owner of Acme Corp and can see the organization dashboard."

**[INVITING TEAM MEMBERS - 6:00-7:15]**

*[Screen: Organization dashboard]*

"Now let's invite a team member. I'll go to the team management section:"

*[Navigate to team page]*

"I'll invite a colleague with the 'admin' role:"

*[Send invitation]*

"The invitation email is sent. Let me show you what happens when they accept:"

*[Screen: Open development inbox]*

"Here's the invitation email. When they click accept, they'll be added to our organization with admin privileges."

**[ORGANIZATION SWITCHING - 7:15-8:30]**

*[Screen: Create second organization]*

"Let me create a second organization to demonstrate organization switching:"

*[Create 'Beta Inc' organization]*

"Now I belong to two organizations. Notice the organization switcher in the navigation:"

*[Screen: Show organization switcher dropdown]*

"I can switch between Acme Corp and Beta Inc. When I switch, my entire context changes - the data I see, my role, and my permissions are all scoped to the current organization."

*[Demonstrate switching between organizations]*

**[ROLE-BASED ACCESS CONTROL - 8:30-9:30]**

*[Screen: Show different role experiences]*

"Let's see role-based access control in action. As an owner, I can access all features:"

*[Show admin panels and settings]*

"But if I simulate being a regular member:"

*[Screen: Code showing role guard]*

```typescript
// This component is only visible to admins
<RoleGuard requiredRole="admin">
  <AdminPanel />
</RoleGuard>
```

"Members won't see admin-only features. The role system is enforced both in the UI and at the API level."

**[DATA ISOLATION - 9:30-10:15]**

*[Screen: Database query examples]*

"Behind the scenes, Row Level Security ensures complete data isolation. Users in Acme Corp can never see data from Beta Inc, even if they tried to manipulate API calls."

*[Show RLS policy examples]*

"This is enforced at the database level, making it impossible to accidentally leak data between tenants."

**[WRAP-UP - 10:15-10:30]**

*[Screen: Summary of features built]*

"In 10 minutes, we've built a complete multi-tenant SaaS authentication system with:
- Organization management
- Team invitations
- Role-based access control
- Organization switching
- Complete data isolation"

"This would typically take weeks to build from scratch, but Truxe makes it possible in minutes."

---

## 🎬 Tutorial 3: "Migrating from Clerk to Truxe"

**Duration**: 12-15 minutes  
**Audience**: Developers currently using Clerk  
**Goal**: Complete migration with zero downtime

### Script

**[INTRO - 0:00-0:45]**

*[Screen: Side-by-side comparison of Clerk vs Truxe]*

"Tired of vendor lock-in and rising authentication costs? Today I'll show you how to migrate from Clerk to Truxe with zero downtime and preserve all your user data."

*[Screen: Migration benefits]*

"We'll migrate users, organizations, and sessions while maintaining full compatibility with your existing code."

**[PRE-MIGRATION ANALYSIS - 0:45-2:00]**

*[Screen: Existing Clerk application]*

"Here's our existing application using Clerk. It has user authentication, organizations, and role-based access."

*[Screen: Clerk dashboard showing user data]*

"Let's analyze what we need to migrate:
- 1,247 users
- 15 organizations  
- User metadata and roles
- Current sessions"

**[DATA EXPORT - 2:00-3:30]**

*[Screen: Terminal]*

"First, let's export our data from Clerk. I'll use the Clerk Management API:"

```bash
# Install Clerk CLI
npm install -g @clerk/clerk-cli

# Export users
clerk-export users --output=clerk-users.json

# Export organizations  
clerk-export organizations --output=clerk-orgs.json
```

*[Show export process and resulting JSON files]*

"Perfect! We now have all our Clerk data exported."

**[TRUXE SETUP - 3:30-4:45]**

*[Screen: New terminal]*

"Now let's set up Truxe in parallel with our existing Clerk setup:"

```bash
# Install Truxe CLI
npm install -g @truxe/cli

# Initialize migration project
truxe init --migrate-from=clerk --data=./clerk-users.json
```

*[Show Truxe setup with migration flags]*

"The migration setup creates a parallel authentication system and prepares data transformation scripts."

**[DATA MIGRATION - 4:45-6:30]**

*[Screen: Migration process]*

"Let's run the automated migration:"

```bash
truxe migrate --from=clerk --data=./clerk-users.json --orgs=./clerk-orgs.json
```

*[Show migration progress]*

"The migration tool is:
- Transforming user data to Truxe format
- Creating organizations and memberships
- Preserving user metadata
- Setting up equivalent role mappings"

*[Screen: Show migration results]*

"Excellent! All 1,247 users and 15 organizations migrated successfully."

**[CODE MIGRATION - 6:30-8:30]**

*[Screen: VS Code showing Clerk code]*

"Now let's update our application code. The migration tool can automatically transform most Clerk code:"

```bash
truxe migrate code --from=clerk --path=./src
```

*[Show code transformation in progress]*

"Let's see what changed:"

*[Screen: Side-by-side code comparison]*

"Before (Clerk):"
```typescript
import { useUser } from '@clerk/nextjs';

const { user } = useUser();
```

"After (Truxe):"
```typescript
import { useUser } from '@truxe/react';

const { user } = useUser();
```

"The API is nearly identical, making migration seamless."

**[PARALLEL TESTING - 8:30-10:00]**

*[Screen: Running both systems]*

"Let's test our migrated system alongside Clerk:"

```bash
# Start Truxe
npm run truxe.io

# Start our app with Truxe
NEXT_PUBLIC_AUTH_PROVIDER=truxe npm run dev
```

*[Screen: Testing login flows]*

"I'll test logging in with the same email used in Clerk:"

*[Demonstrate successful login with migrated data]*

"Perfect! The user data, organization membership, and roles are all preserved."

**[GRADUAL CUTOVER - 10:00-11:30]**

*[Screen: Deployment strategy]*

"For production, we'll do a gradual cutover. First, I'll deploy Truxe alongside Clerk:"

```bash
# Environment variables for dual auth
ENABLE_CLERK=true
ENABLE_TRUXE=true
MIGRATION_MODE=true
```

*[Screen: Code showing dual authentication]*

```typescript
// Gradual migration component
function AuthProvider({ children }) {
  const clerkUser = useClerkUser();
  const truxeUser = useTruxeUser();
  
  // Prefer Truxe if available, fallback to Clerk
  const user = truxeUser || clerkUser;
  
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
```

**[FINAL CUTOVER - 11:30-12:30]**

*[Screen: Production deployment]*

"After testing, we can complete the migration:"

```bash
# Disable Clerk
ENABLE_CLERK=false
ENABLE_TRUXE=true
MIGRATION_MODE=false
```

*[Screen: Monitoring dashboard]*

"Let's monitor the cutover in real-time. All users are now authenticating through Truxe successfully."

**[POST-MIGRATION CLEANUP - 12:30-13:00]**

*[Screen: Cleanup checklist]*

"Finally, let's clean up:
- Remove Clerk dependencies
- Update environment variables  
- Remove migration code
- Update documentation"

```bash
npm uninstall @clerk/nextjs @clerk/themes
```

**[WRAP-UP - 13:00-13:15]**

*[Screen: Before/after comparison]*

"Migration complete! We've successfully moved from Clerk to Truxe with:
- Zero data loss
- Zero downtime  
- Preserved user experience
- Reduced costs
- No vendor lock-in"

"Your users didn't even notice the change, but you now have full control over your authentication system."

---

## 🎬 Tutorial 4: "Securing Your API with Advanced Rate Limiting"

**Duration**: 8-10 minutes  
**Audience**: Backend developers  
**Goal**: Implement comprehensive API protection

### Script

**[INTRO - 0:00-0:30]**

*[Screen: API attack visualization]*

"API attacks are increasing 200% year over year. Today I'll show you how to protect your APIs with Truxe's advanced rate limiting that goes far beyond basic throttling."

*[Screen: Multi-layer protection diagram]*

"We'll implement multi-layer protection that stops attacks while keeping legitimate users happy."

**[CURRENT STATE ANALYSIS - 0:30-1:15]**

*[Screen: Unprotected API]*

"Here's a typical API without protection. Let me demonstrate how vulnerable it is:"

*[Screen: Terminal with curl commands]*

```bash
# Spam the API
for i in {1..100}; do
  curl -X POST http://localhost:3001/auth/magic-link \
    -d '{"email":"spam@test.com"}' &
done
```

*[Show server getting overwhelmed]*

"The server is struggling with just 100 concurrent requests. In a real attack, this would be thousands."

**[ENABLING ADVANCED RATE LIMITING - 1:15-2:30]**

*[Screen: Truxe configuration]*

"Let's enable Truxe's advanced rate limiting:"

```bash
# Enable multi-layer protection
RATE_LIMIT_ENABLED=true
RATE_LIMIT_LAYERS=ip,user,endpoint,ddos
REDIS_URL=redis://localhost:6379
```

*[Screen: Configuration file]*

"I'll configure different protection layers:"

```javascript
// Rate limiting configuration
const rateLimits = {
  // Layer 1: IP-based protection
  ip: {
    global: '1000/1h',
    burst: '100/1m'
  },
  
  // Layer 2: Endpoint-specific limits
  endpoints: {
    'POST:/auth/magic-link': {
      perIP: '5/1m',
      perEmail: '3/1h'
    }
  },
  
  // Layer 3: User plan limits
  plans: {
    free: '1000/1h',
    pro: '10000/1h'
  }
};
```

**[TESTING PROTECTION LAYERS - 2:30-4:00]**

*[Screen: Testing each layer]*

"Let's test each protection layer:"

*[Terminal: IP-based limiting]*

```bash
# This will be blocked after 5 requests
for i in {1..10}; do
  curl -X POST http://localhost:3001/auth/magic-link \
    -d '{"email":"test@example.com"}'
done
```

*[Show rate limit responses]*

"Perfect! After 5 requests, we get HTTP 429 with retry information."

*[Screen: Show rate limit headers]*

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1642248660
Retry-After: 60
```

**[DDOS PROTECTION - 4:00-5:30]**

*[Screen: DDoS simulation]*

"Now let's test DDoS protection with a massive attack simulation:"

```bash
# Simulate DDoS attack
truxe simulate ddos --requests=10000 --concurrency=100
```

*[Screen: Monitoring dashboard]*

"Watch the monitoring dashboard. The system detects the attack pattern and activates emergency protection:"

*[Show circuit breaker activation]*

"The circuit breaker activated, emergency rate limits are in place, and malicious IPs are automatically blocked."

**[PLAN-BASED QUOTAS - 5:30-6:30]**

*[Screen: User plan enforcement]*

"Let's see plan-based quota enforcement in action. I'll create users with different plans:"

```javascript
// Free tier user
const freeUser = await createUser({ 
  email: 'free@example.com', 
  plan: 'free' 
});

// Pro user  
const proUser = await createUser({
  email: 'pro@example.com',
  plan: 'pro'
});
```

*[Screen: Testing different quotas]*

"Free users are limited to 1000 API calls per hour, while Pro users get 10,000:"

*[Show quota enforcement in action]*

**[MONITORING AND ALERTS - 6:30-7:30]**

*[Screen: Admin dashboard]*

"The admin dashboard shows real-time protection metrics:"

*[Navigate through dashboard sections]*

"- Rate limit violations by IP and user
- Attack patterns and blocked requests
- Plan quota utilization
- Performance impact metrics"

*[Screen: Alert configuration]*

"I can configure alerts for security events:"

```bash
# Slack webhook for critical alerts
ALERT_WEBHOOK=https://hooks.slack.com/...
ALERT_DDOS_THRESHOLD=5
ALERT_RATE_LIMIT_VIOLATIONS=100
```

**[CUSTOMIZATION - 7:30-8:30]**

*[Screen: Custom rate limiting rules]*

"You can customize rules for your specific needs:"

```javascript
// Custom rules for different endpoints
const customRules = {
  'POST:/api/upload': {
    perUser: '10/1h',    // File uploads
    sizeLimit: '100MB'
  },
  
  'GET:/api/search': {
    perIP: '1000/1h',    // Search queries
    perUser: '5000/1h'
  },
  
  'POST:/api/payment': {
    perUser: '5/1m',     // Payment processing
    requireAuth: true
  }
};
```

**[WRAP-UP - 8:30-8:45]**

*[Screen: Protection summary]*

"We've implemented enterprise-grade API protection with:
- Multi-layer rate limiting
- DDoS attack prevention
- Plan-based quota enforcement
- Real-time monitoring
- Automatic threat response"

"Your APIs are now protected against the most common attack vectors while maintaining excellent performance for legitimate users."

---

## 🎬 Tutorial 5: "Building a Secure Admin Dashboard"

**Duration**: 10-12 minutes  
**Audience**: Full-stack developers  
**Goal**: Create comprehensive admin interface

### Script

**[INTRO - 0:00-0:30]**

*[Screen: Admin dashboard preview]*

"Every authentication system needs a powerful admin dashboard for user management, security monitoring, and system administration. Today I'll show you how to build one with Truxe's admin APIs."

**[SETUP - 0:30-1:30]**

*[Screen: Project initialization]*

"Let's create an admin dashboard project:"

```bash
truxe init admin-dashboard --template=nextjs --admin=true
```

*[Show admin-specific components and routes being created]*

**[ADMIN AUTHENTICATION - 1:30-2:30]**

*[Screen: Admin login implementation]*

"First, let's implement admin authentication with role-based access:"

```typescript
// Admin route protection
export default function AdminLayout({ children }) {
  const { user } = useAuth();
  
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return <Unauthorized />;
  }
  
  return <AdminInterface>{children}</AdminInterface>;
}
```

**[USER MANAGEMENT - 2:30-4:30]**

*[Screen: User management interface]*

"The user management interface lets us view, edit, and manage all users:"

*[Demonstrate user listing, search, and filtering]*

"I can search users, view their details, and manage their accounts:"

*[Show user detail modal with session information]*

"For each user, I can see:
- Account information and metadata
- Active sessions and devices
- Organization memberships
- Security events and audit trail"

**[SECURITY MONITORING - 4:30-6:30]**

*[Screen: Security dashboard]*

"The security monitoring dashboard provides real-time threat intelligence:"

*[Navigate through security metrics]*

"Here I can monitor:
- Failed authentication attempts
- Rate limit violations
- Impossible travel detections
- Suspicious activity patterns"

*[Screen: Security event details]*

"Each security event includes detailed information for investigation:"

*[Show event drill-down with context and response actions]*

**[SYSTEM ADMINISTRATION - 6:30-8:30]**

*[Screen: System admin tools]*

"The system administration section provides operational controls:"

*[Demonstrate various admin functions]*

"I can:
- Manage rate limiting rules in real-time
- Block or unblock IP addresses
- Revoke user sessions for security
- Configure system settings
- Monitor system health"

**[ANALYTICS AND REPORTING - 8:30-10:00]**

*[Screen: Analytics dashboard]*

"The analytics section provides insights into usage patterns:"

*[Show various charts and metrics]*

"Key metrics include:
- Authentication success rates
- User growth and retention
- Geographic distribution
- Plan utilization
- Performance metrics"

**[CUSTOMIZATION - 10:00-11:00]**

*[Screen: Dashboard customization]*

"The dashboard is fully customizable. Let me add a custom widget:"

```typescript
// Custom admin widget
function CustomMetricsWidget() {
  const { data } = useAdminMetrics('custom-query');
  
  return (
    <Widget title="Custom Metrics">
      <MetricsChart data={data} />
    </Widget>
  );
}
```

**[WRAP-UP - 11:00-11:15]**

*[Screen: Complete admin dashboard]*

"We've built a comprehensive admin dashboard with user management, security monitoring, system administration, and analytics - everything needed to manage an authentication system at scale."

---

## 📋 Production Checklist

### Pre-Recording
- [ ] Clean desktop and browser
- [ ] Test all commands and scripts
- [ ] Prepare sample data and accounts
- [ ] Set up screen recording software
- [ ] Test audio quality
- [ ] Prepare backup plans for demos

### During Recording
- [ ] Speak clearly and at moderate pace
- [ ] Highlight mouse cursor for visibility
- [ ] Wait for commands to complete
- [ ] Explain what's happening during waits
- [ ] Show error handling when relevant
- [ ] Keep energy level consistent

### Post-Production
- [ ] Edit out long waits and mistakes
- [ ] Add captions/subtitles
- [ ] Include chapter markers
- [ ] Add intro/outro graphics
- [ ] Export in multiple formats
- [ ] Test final video quality

### Distribution
- [ ] Upload to YouTube with proper SEO
- [ ] Create accompanying blog posts
- [ ] Share on social media
- [ ] Add to documentation
- [ ] Create video playlists
- [ ] Monitor engagement and feedback

---

These scripts provide a solid foundation for creating professional video tutorials that will help users quickly understand and implement Truxe authentication in their applications.
