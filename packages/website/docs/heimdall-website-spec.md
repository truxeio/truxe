# 🛡️ Truxe Website - Komple Proje Dökümanı

## 📑 İçindekiler
1. [Proje Özeti](#proje-özeti)
2. [Teknoloji Stack](#teknoloji-stack)
3. [Proje Yapısı](#proje-yapısı)
4. [Truxe'ın Temel Özellikleri (İçerik için)](#truxe-özellikleri)
5. [Rakip Analizi & Positioning](#rakip-analizi)
6. [Sayfa Detayları & İçerik Stratejisi](#sayfa-detayları)
7. [Tasarım Prensipler](#tasarım-prensipleri)
8. [Kurulum Adımları](#kurulum-adımları)
9. [Deployment Stratejisi](#deployment-stratejisi)
10. [Yasal Gereklilikler](#yasal-gereklilikler)

---

## 🎯 Proje Özeti

### Proje Adı
`truxe-website`

### Amaç
Truxe Authentication & Authorization Service için modern, developer-focused bir landing page/marketing website oluşturmak.

### Hedef Kitle
- Backend developers
- DevOps engineers
- Technical decision makers (CTOs, Lead Developers)
- Startup founders (teknik altyapı arayan)

### Ana Mesaj
"Enterprise-grade authentication & authorization that you can actually understand and control"

### Pozisyonlama
- **Supabase'e karşı:** Daha özelleştirilebilir, daha az "magic", daha fazla kontrol
- **Clerk'e karşı:** Daha ucuz, self-hostable, vendor lock-in yok
- **Auth0'a karşı:** Daha modern, daha basit, developer-friendly

---

## 🔧 Teknoloji Stack

### Frontend Framework
```json
{
  "framework": "Next.js 14.2+",
  "rendering": "App Router (RSC + Client Components)",
  "language": "TypeScript 5.0+",
  "styling": "TailwindCSS 3.4+",
  "animations": "Framer Motion 11+",
  "icons": "Lucide React (shield icon için)"
}
```

### Önerilen Paketler
```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.300.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

### Third-party Services
- **Analytics:** Plausible.io (cookie-free)
- **Email:** Brevo (waitlist için)
- **Hosting:** Vercel
- **Domain:** gettruxe.dev

---

## 📁 Proje Yapısı

```
truxe-website/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Homepage (single-page landing)
│   ├── privacy/
│   │   └── page.tsx              # Privacy Policy
│   ├── terms/
│   │   └── page.tsx              # Terms of Service
│   ├── support/
│   │   └── page.tsx              # Support/Contact page
│   └── api/
│       └── waitlist/
│           └── route.ts          # Waitlist form endpoint
├── components/
│   ├── sections/
│   │   ├── Hero.tsx              # Hero section
│   │   ├── Features.tsx          # Features grid
│   │   ├── Comparison.tsx        # vs Competitors
│   │   ├── Architecture.tsx      # Technical overview
│   │   ├── Waitlist.tsx          # Waitlist form
│   │   └── Footer.tsx            # Footer with Wundam link
│   ├── ui/
│   │   ├── Button.tsx            # Reusable button
│   │   ├── Card.tsx              # Feature cards
│   │   ├── Input.tsx             # Form inputs
│   │   └── Badge.tsx             # Status badges
│   └── animations/
│       └── FadeIn.tsx            # Scroll animations
├── lib/
│   ├── utils.ts                  # Utility functions (cn, etc.)
│   ├── brevo.ts                  # Brevo API integration
│   └── constants.ts              # Site constants
├── public/
│   ├── favicon.ico
│   ├── logo.svg                  # Truxe logo (shield)
│   └── og-image.png              # Social media preview
├── styles/
│   └── globals.css               # Global styles + Tailwind
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
├── package.json
└── README.md
```

---

## 🛡️ Truxe'ın Temel Özellikleri (İçerik için)

### 1. Authentication (Kimlik Doğrulama)

#### Magic Link Authentication
```
Özellik: Passwordless authentication via email
Avantaj: Daha güvenli (phishing'e karşı dayanıklı), kullanıcı deneyimi daha iyi
Teknik Detay: JWT-based, 15 dakika geçerlilik süresi
```

#### Multi-Factor Authentication (MFA)
```
TOTP Support: Google Authenticator, Authy uyumlu
Backup Codes: 10 adet tek kullanımlık recovery kodu
Security: TOTP secret'ları encrypted storage, backup code'lar bcrypt hashed
```

#### OAuth 2.0 Providers
```
Desteklenen: Google, GitHub, (genişletilebilir)
Özellik: PKCE flow support
Device Fingerprinting: Güvenlik için cihaz tanıma
```

### 2. Session Management (Oturum Yönetimi)

#### Advanced Session Security
```
- JWT with JTI (JWT ID) for revocation
- Redis-based session store (hızlı, scalable)
- Device fingerprinting (güvenlik)
- Concurrent session limits (hesap paylaşımını önler)
- Session activity tracking (last_active_at)
```

#### Automatic Token Rotation
```
Access Token: 15 dakika (kısa ömürlü güvenlik)
Refresh Token: 7 gün, otomatik rotation
Sliding Window: Aktif kullanıcılar için seamless experience
```

### 3. Authorization (Yetkilendirme) - RBAC

#### Role-Based Access Control
```
Roller: admin, manager, member, guest (özelleştirilebilir)
Permissions: Granular permission system
Organization-level: Multi-tenant support
Resource-level: Specific resource permissions
```

#### Organization Management
```
Multi-tenancy: Her organization izole
Roles & Permissions: Org-level role assignment
Invitations: Email-based org invitations
Member Management: Add/remove/update members
```

### 4. Security Features

#### Security Monitoring & Alerts
```
Real-time Monitoring:
- Failed login attempts
- Suspicious location logins
- Unusual device logins
- MFA failures
- Token tampering attempts

Alert Channels:
- Email (Brevo)
- Webhook (Slack, Discord, custom)
- In-app notifications
```

#### Threat Detection
```
Rate Limiting: IP ve user-based
Brute Force Protection: Progressive delays
Device Fingerprinting: Anomaly detection
GeoIP Analysis: Location-based risk scoring
```

#### Security Incident Response
```
Automated Actions:
- Account lockdown
- Force logout (all sessions)
- MFA requirement trigger
- Admin notifications

Manual Controls:
- Incident investigation dashboard
- User activity logs
- Audit trail
```

### 5. Developer Experience

#### REST API
```
Modern RESTful API
Comprehensive documentation
Postman collection
Rate limiting (protective)
```

#### SDKs (Future)
```
Planned: JavaScript/TypeScript, Python, Go
OAuth client libraries
Session management helpers
```

#### Self-Hosted
```
Docker support
Database migrations included (Drizzle ORM)
Environment-based configuration
Health check endpoints
```

---

## 🥊 Rakip Analizi & Positioning

### Rakiplerle Kıyaslama - Yasal Durum

**SORU:** Rakip isimlerini kullanabilir miyiz?

**CEVAP:** **Evet, kullanabilirsiniz!**

#### Yasal Açıdan:
1. **Fair Use / Comparative Advertising:** ABD ve AB'de karşılaştırmalı reklamlar yasaldır
2. **Şartlar:**
   - ✅ Doğru bilgiler (yalan söylemek yasak)
   - ✅ Adil karşılaştırma (yanıltıcı olmayan)
   - ✅ Trademark kullanımı referans amaçlı (logo kullanmıyoruz, sadece isim)
   - ✅ Kötüleme yok, sadece özellik karşılaştırması

3. **Örnekler:**
   - Vercel "vs Netlify" comparison page var
   - Linear "vs Jira" comparison yapıyor
   - Supabase "vs Firebase" diyor

**SONUÇ:** İsim verebiliriz, ama profesyonel ve doğru bilgilerle.

### Rakip Karşılaştırma Tablosu

#### vs Supabase Auth
```
┌─────────────────────┬──────────────┬──────────┐
│ Feature             │ Truxe     │ Supabase │
├─────────────────────┼──────────────┼──────────┤
│ Self-hosted         │ ✅ Full      │ ⚠️ Limited│
│ MFA (TOTP)          │ ✅           │ ✅        │
│ RBAC                │ ✅ Advanced  │ ⚠️ Basic  │
│ Session Management  │ ✅ Advanced  │ ✅ Basic  │
│ Security Monitoring │ ✅           │ ❌        │
│ Threat Detection    │ ✅           │ ❌        │
│ Custom Alerts       │ ✅ Multi-ch. │ ❌        │
│ Device Tracking     │ ✅ Full      │ ⚠️ Limited│
│ Pricing             │ 💰 Open      │ 💰 Per MAU│
│ Vendor Lock-in      │ ❌ None      │ ⚠️ High   │
│ Learning Curve      │ 🎓 Medium    │ 🎓 Low    │
└─────────────────────┴──────────────┴──────────┘
```

#### vs Clerk
```
┌─────────────────────┬──────────────┬──────────┐
│ Feature             │ Truxe     │ Clerk    │
├─────────────────────┼──────────────┼──────────┤
│ Self-hosted         │ ✅ Yes       │ ❌ No     │
│ Pricing             │ 💰 Free      │ 💰💰💰 $$$│
│ Organization RBAC   │ ✅           │ ✅        │
│ MFA                 │ ✅           │ ✅        │
│ UI Components       │ ⚠️ Headless  │ ✅ Full   │
│ Customization       │ ✅ Full      │ ⚠️ Limited│
│ Security Monitoring │ ✅           │ ⚠️ Basic  │
│ Vendor Lock-in      │ ❌ None      │ ⚠️ High   │
│ Data Ownership      │ ✅ Full      │ ❌ Clerk's│
│ API Control         │ ✅ Full      │ ⚠️ Limited│
└─────────────────────┴──────────────┴──────────┘
```

#### vs Auth0
```
┌─────────────────────┬──────────────┬──────────┐
│ Feature             │ Truxe     │ Auth0    │
├─────────────────────┼──────────────┼──────────┤
│ Modern Tech Stack   │ ✅ Latest    │ ⚠️ Legacy │
│ Self-hosted         │ ✅ Yes       │ ❌ No     │
│ Pricing             │ 💰 Free      │ 💰💰 $$   │
│ Developer UX        │ ✅ Clean API │ ⚠️ Complex│
│ Security Features   │ ✅ Advanced  │ ✅ Advanced│
│ RBAC                │ ✅           │ ✅        │
│ Learning Curve      │ 🎓 Medium    │ 🎓 High   │
│ Setup Time          │ ⚡ Minutes   │ ⏱️ Hours  │
│ Vendor Lock-in      │ ❌ None      │ ⚠️ High   │
└─────────────────────┴──────────────┴──────────┘
```

### Positioning Statement (Messaging)

```markdown
## For Developers Who Want Control

Truxe is an open-source authentication & authorization service
that gives you enterprise-grade security without vendor lock-in.

Unlike Supabase (limited RBAC) or Clerk (expensive, closed-source),
Truxe offers:
- Full self-hosting control
- Advanced RBAC & multi-tenancy
- Built-in security monitoring
- No per-user pricing
- Modern, clean API

Perfect for:
- Startups that need to scale without ballooning auth costs
- Teams that want data ownership
- Developers who value transparency and customization
```

---

## 📄 Sayfa Detayları & İçerik Stratejisi

### Homepage (Single-Page Landing)

#### 1. Hero Section
```typescript
HEADLINE: "Authentication & Authorization Built for Developers"

SUBHEADLINE:
"Open-source, self-hosted auth service with enterprise-grade security.
No vendor lock-in. No per-user pricing. Full control."

CTA:
- Primary: "Join Waitlist" (scroll to form)
- Secondary: "View Documentation" (future link)

VISUAL:
- Animated shield icon (Truxe logo)
- Code snippet preview (örnek: magic link authentication)
- Background: Subtle grid pattern (Wundam/Hippoc style)
```

#### 2. Problem Statement
```markdown
### The Problem with Existing Auth Solutions

**Supabase:** Great for quick starts, but limited RBAC and vendor lock-in.
**Clerk:** Beautiful UI, expensive pricing (scales poorly for startups).
**Auth0:** Powerful but complex, steep learning curve, legacy tech.

You need authentication that's:
✓ Easy to integrate
✓ Affordable at scale
✓ Fully customizable
✓ Transparent and trustworthy
```

#### 3. Features Section (Grid Layout)

```typescript
const features = [
  {
    icon: "🔐",
    title: "Magic Link Authentication",
    description: "Passwordless auth via email. More secure, better UX.",
    tech: "JWT-based, 15min expiry"
  },
  {
    icon: "📱",
    title: "Multi-Factor Authentication",
    description: "TOTP with Google Authenticator + backup codes.",
    tech: "Encrypted secrets, bcrypt hashing"
  },
  {
    icon: "🔑",
    title: "OAuth 2.0 Providers",
    description: "Google, GitHub, and more. PKCE flow support.",
    tech: "Device fingerprinting included"
  },
  {
    icon: "⚡",
    title: "Advanced Session Management",
    description: "JWT with JTI revocation, Redis-backed, auto token rotation.",
    tech: "15min access, 7 day refresh"
  },
  {
    icon: "👥",
    title: "Role-Based Access Control",
    description: "Granular permissions, org-level roles, multi-tenancy.",
    tech: "Resource-level authorization"
  },
  {
    icon: "🛡️",
    title: "Security Monitoring",
    description: "Real-time threat detection, alerts, incident response.",
    tech: "Email, webhook, in-app alerts"
  },
  {
    icon: "📊",
    title: "Device Fingerprinting",
    description: "Track and identify devices for anomaly detection.",
    tech: "Browser, OS, IP analysis"
  },
  {
    icon: "🔄",
    title: "Automatic Token Rotation",
    description: "Sliding window refresh tokens for seamless UX.",
    tech: "Zero-downtime rotation"
  },
  {
    icon: "🏢",
    title: "Organization Management",
    description: "Multi-tenant support, invitations, member management.",
    tech: "Isolated org contexts"
  }
];
```

#### 4. Comparison Section

```markdown
### How Truxe Compares

[Interactive comparison table]

**Use Truxe if you:**
- Want full control over your auth infrastructure
- Need advanced RBAC and security features
- Don't want to pay per-user
- Value transparency and open-source

**Consider alternatives if you:**
- Need pre-built UI components (→ Clerk)
- Want managed-only service (→ Auth0)
- Prefer integrated database (→ Supabase)
```

#### 5. Architecture/Technical Overview

```markdown
### Built with Modern Tech

**Backend:** Node.js + Fastify (high performance)
**Database:** PostgreSQL + Redis (reliability + speed)
**Security:** Industry-standard encryption (bcrypt, JWT, TOTP)
**Scalability:** Stateless architecture, horizontal scaling ready
**DevOps:** Docker-ready, health checks included

[Architecture diagram - optional]
```

#### 6. Use Cases

```markdown
### Who Uses Truxe?

**SaaS Startups:** Multi-tenant apps with org-level permissions
**Developer Tools:** APIs that need granular authorization
**Internal Tools:** Enterprise apps with complex role hierarchies
**Privacy-Conscious Apps:** Self-hosted auth for data ownership
```

#### 7. Waitlist Section

```typescript
HEADLINE: "Be the First to Know"

FORM:
- Email input
- Company/Project name (optional)
- Use case (dropdown: SaaS, Internal Tool, API, Other)
- "Join Waitlist" button

COPY:
"Truxe is in active development. Join the waitlist to get:
- Early access to the beta
- Documentation and setup guides
- Updates on new features"

INTEGRATION: Brevo API (collect emails + metadata)
```

#### 8. Footer

```markdown
### Footer Layout

LEFT:
- Truxe logo + tagline
- "Built by Wundam LLC" (link to wundam.com)

CENTER:
- Links: Privacy | Terms | Support
- GitHub (future)
- Documentation (future)

RIGHT:
- Contact: support@gettruxe.dev
- Powered by Wundam (hippoc.io tarzı minimal link)

BOTTOM:
© 2025 Wundam LLC. All rights reserved.
```

---

### Privacy Policy Page (`/privacy`)

**Neden Gerekli:** Google OAuth approval için zorunlu

**İçerik:**
```markdown
# Privacy Policy

Last updated: [DATE]

## Data We Collect
- Email addresses (waitlist)
- Usage analytics (Plausible, cookie-free)
- No tracking cookies

## How We Use Data
- Waitlist communication (Brevo)
- Product updates
- Security notifications

## Data Storage
- Email data: Brevo (EU servers)
- Analytics: Plausible (EU servers)

## Your Rights
- Access your data
- Delete your data
- Opt-out of emails

## Contact
privacy@gettruxe.dev
```

**Önerilen Tool:** [Privacy Policy Generator](https://www.privacypolicygenerator.info/) veya hukuki danışman

---

### Terms of Service Page (`/terms`)

**Neden Gerekli:** Google OAuth + yasal koruma

**İçerik:**
```markdown
# Terms of Service

## Waitlist Terms
- Beta access not guaranteed
- Service provided "as-is"
- May change features before launch

## Usage Terms
- Don't abuse the service
- Don't violate laws
- We may terminate accounts

## Liability
- No warranties
- Limited liability

## Governing Law
[Your jurisdiction]
```

---

### Support/Contact Page (`/support`)

**Neden Gerekli:** OAuth apps için support link gerekli

**İçerik:**
```markdown
# Support

## Get Help

**Email:** support@gettruxe.dev
**Response time:** Within 48 hours (weekdays)

## Documentation
[Coming soon]

## Report a Bug
Email us with:
- Description
- Steps to reproduce
- Expected vs actual behavior

## Feature Requests
We're actively developing Truxe. Send your ideas!
```

---

## 🎨 Tasarım Prensipleri

### Design System (Wundam/Hippoc Inspired)

#### Color Palette
```css
/* Monochrome base (Hippoc style) */
--color-background: #FFFFFF;
--color-foreground: #000000;
--color-gray-50: #FAFAFA;
--color-gray-100: #F5F5F5;
--color-gray-200: #E5E5E5;
--color-gray-300: #D4D4D4;
--color-gray-600: #525252;
--color-gray-900: #171717;

/* Accent (security = blue shield) */
--color-primary: #2563EB;    /* Blue 600 */
--color-primary-dark: #1E40AF;
--color-primary-light: #DBEAFE;

/* Status colors */
--color-success: #10B981;
--color-warning: #F59E0B;
--color-error: #EF4444;
```

#### Typography
```css
/* Hippoc uses Inter, modern alternative: */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Sizes (mobile-first) */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px - hero headlines */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### Spacing
```css
/* Consistent spacing scale */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-24: 6rem;    /* 96px */
```

#### Layout
```typescript
/* Container widths */
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;

/* Section padding */
padding-y: 96px (desktop), 64px (mobile)
padding-x: 24px (mobile), 48px (desktop)
```

#### Components Style

**Buttons:**
```css
/* Primary button */
background: var(--color-primary);
color: white;
padding: 12px 24px;
border-radius: 8px;
font-weight: 600;
transition: all 150ms ease;

hover: {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

/* Secondary button */
background: transparent;
border: 1px solid var(--color-gray-300);
color: var(--color-foreground);
```

**Cards:**
```css
background: white;
border: 1px solid var(--color-gray-200);
border-radius: 12px;
padding: 24px;
transition: all 200ms ease;

hover: {
  border-color: var(--color-primary-light);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}
```

**Input Fields:**
```css
border: 1px solid var(--color-gray-300);
border-radius: 8px;
padding: 12px 16px;
font-size: 16px; /* Prevents iOS zoom */

focus: {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

#### Animations (Framer Motion)

```typescript
// Fade in on scroll
const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

// Stagger children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Shield icon pulse
const shieldPulse = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut"
  }
};
```

### Logo Design (Truxe Shield)

**Concept:**
- Minimalist shield icon
- Modern, geometric
- Works in monochrome and color

**Inspiration:**
```
   ___
  /   \
 |  H  |  ← "H" for Truxe
 |     |
  \___/
```

**Implementation:**
- SVG format
- Scalable
- Two versions: icon-only, icon + wordmark

**Colors:**
- Primary: Blue (#2563EB)
- Monochrome: Black/White variants

---

## 🚀 Kurulum Adımları (Step-by-Step)

### 1. Proje Oluşturma

```bash
# Yeni klasör
mkdir truxe-website
cd truxe-website

# Next.js initialize (TypeScript + TailwindCSS + App Router)
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"

# Ek paketler
npm install framer-motion lucide-react clsx tailwind-merge
npm install -D @types/node
```

### 2. Tailwind Config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          dark: '#1E40AF',
          light: '#DBEAFE',
        },
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          600: '#525252',
          900: '#171717',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      }
    },
  },
  plugins: [],
}
export default config
```

### 3. Global Styles

```css
/* styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply scroll-smooth;
  }

  body {
    @apply bg-white text-gray-900 antialiased;
  }
}

@layer components {
  .container-custom {
    @apply max-w-7xl mx-auto px-6 md:px-12;
  }

  .section-padding {
    @apply py-16 md:py-24;
  }
}
```

### 4. Utility Functions

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### 5. Constants

```typescript
// lib/constants.ts
export const SITE_CONFIG = {
  name: 'Truxe',
  description: 'Authentication & Authorization Built for Developers',
  url: 'https://gettruxe.dev',
  ogImage: 'https://gettruxe.dev/og-image.png',
  links: {
    wundam: 'https://wundam.com',
    hippoc: 'https://hippoc.io',
    github: 'https://github.com/wundam/truxe', // future
  },
  contact: {
    email: 'support@gettruxe.dev',
    support: 'support@gettruxe.dev',
    privacy: 'privacy@gettruxe.dev',
  }
}

export const FEATURES = [
  {
    icon: '🔐',
    title: 'Magic Link Authentication',
    description: 'Passwordless auth via email. More secure, better UX.',
    tech: 'JWT-based, 15min expiry'
  },
  // ... diğer features
]

export const COMPARISON_DATA = {
  supabase: {
    name: 'Supabase Auth',
    features: {
      selfHosted: 'limited',
      mfa: true,
      rbac: 'basic',
      // ...
    }
  },
  // ...
}
```

### 6. Component Örnekleri

```typescript
// components/ui/Button.tsx
import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-semibold transition-all',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'bg-primary text-white hover:bg-primary-dark focus:ring-primary': variant === 'primary',
            'border border-gray-300 bg-transparent hover:bg-gray-50': variant === 'secondary',
            'px-4 py-2 text-sm': size === 'sm',
            'px-6 py-3 text-base': size === 'md',
            'px-8 py-4 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
```

```typescript
// components/sections/Hero.tsx
'use client'

import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function Hero() {
  return (
    <section className="container-custom section-padding min-h-screen flex items-center">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Shield className="w-20 h-20 mx-auto text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl md:text-6xl font-bold mb-6"
        >
          Authentication & Authorization
          <br />
          <span className="text-primary">Built for Developers</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto"
        >
          Open-source, self-hosted auth service with enterprise-grade security.
          No vendor lock-in. No per-user pricing. Full control.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 justify-center"
        >
          <Button size="lg" onClick={() => {
            document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })
          }}>
            Join Waitlist
          </Button>
          <Button size="lg" variant="secondary">
            View Documentation
          </Button>
        </motion.div>
      </div>
    </section>
  )
}
```

### 7. API Route (Waitlist)

```typescript
// app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, company, useCase } = body

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 }
      )
    }

    // Send to Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email,
        attributes: {
          COMPANY: company || '',
          USE_CASE: useCase || 'not_specified',
          SOURCE: 'website_waitlist'
        },
        listIds: [Number(process.env.BREVO_LIST_ID!)],
        updateEnabled: true
      })
    })

    if (!brevoResponse.ok) {
      throw new Error('Brevo API error')
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    )
  }
}
```

### 8. Environment Variables

```bash
# .env.local
BREVO_API_KEY=your_brevo_api_key_here
BREVO_LIST_ID=your_list_id_here

# Next.js config
NEXT_PUBLIC_SITE_URL=https://gettruxe.dev
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=gettruxe.dev
```

### 9. Metadata & SEO

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SITE_CONFIG } from '@/lib/constants'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`
  },
  description: SITE_CONFIG.description,
  keywords: ['authentication', 'authorization', 'RBAC', 'OAuth', 'MFA', 'open-source'],
  authors: [{ name: 'Wundam LLC', url: 'https://wundam.com' }],
  creator: 'Wundam LLC',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_CONFIG.url,
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: SITE_CONFIG.name
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
  },
  icons: {
    icon: '/favicon.ico',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Plausible Analytics */}
        <script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
          src="https://plausible.io/js/script.js"
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

### 10. Folder Structure (Final)

```
truxe-website/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── support/page.tsx
│   └── api/
│       └── waitlist/route.ts
├── components/
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── Comparison.tsx
│   │   ├── Waitlist.tsx
│   │   └── Footer.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Input.tsx
├── lib/
│   ├── utils.ts
│   ├── constants.ts
│   └── brevo.ts
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── og-image.png
├── styles/
│   └── globals.css
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚢 Deployment Stratejisi

### Vercel Deployment

#### 1. Vercel Hesap Setup
```bash
# Vercel CLI install
npm i -g vercel

# Login
vercel login

# Initialize (proje klasöründe)
vercel
```

#### 2. Environment Variables (Vercel Dashboard)
```
BREVO_API_KEY=xxx
BREVO_LIST_ID=xxx
NEXT_PUBLIC_SITE_URL=https://gettruxe.dev
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=gettruxe.dev
```

#### 3. Domain Setup
```
1. Vercel Dashboard > Project Settings > Domains
2. Add: gettruxe.dev
3. Configure DNS:
   - Type: CNAME
   - Name: @
   - Value: cname.vercel-dns.com

   OR (A record):
   - Type: A
   - Name: @
   - Value: 76.76.21.21
```

#### 4. Production Deploy
```bash
# Auto-deploy on git push (recommended)
git remote add origin [your-github-repo]
git push -u origin main

# Manual deploy
vercel --prod
```

### Alternative: Self-Hosted (Wundam Server)

#### Docker Setup
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  website:
    build: .
    ports:
      - "3000:3000"
    environment:
      - BREVO_API_KEY=${BREVO_API_KEY}
      - BREVO_LIST_ID=${BREVO_LIST_ID}
      - NEXT_PUBLIC_SITE_URL=https://gettruxe.dev
    restart: unless-stopped
```

#### Nginx Reverse Proxy
```nginx
# /etc/nginx/sites-available/gettruxe.dev
server {
    listen 80;
    server_name gettruxe.dev www.gettruxe.dev;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gettruxe.dev www.gettruxe.dev;

    ssl_certificate /etc/letsencrypt/live/gettruxe.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gettruxe.dev/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ⚖️ Yasal Gereklilikler

### 1. Privacy Policy (Gerekli)

**Zorunlu Bölümler:**
- Data collection (ne topluyoruz)
- Data usage (nasıl kullanıyoruz)
- Data storage (nerede saklıyoruz)
- User rights (GDPR/CCPA)
- Contact information

**Template kullanın:**
- [TermsFeed](https://www.termsfeed.com/privacy-policy-generator/)
- [Privacy Policy Generator](https://www.privacypolicygenerator.info/)

**Özelleştirme:**
```
Company: Wundam LLC
Website: gettruxe.dev
Contact: privacy@gettruxe.dev
Data collected: Email addresses (waitlist)
Third parties: Brevo (email), Plausible (analytics)
Cookies: None (cookie-free analytics)
User rights: Access, deletion, opt-out
```

### 2. Terms of Service (Önerilen)

**Bölümler:**
- Service description
- Acceptable use policy
- Disclaimer of warranties
- Limitation of liability
- Governing law

### 3. Cookie Policy

**Durum:** Cookie kullanmıyorsanız **banner gerekmez**

**EĞER** cookie kullanacaksanız:
- Consent banner (GDPR)
- Cookie policy page
- Opt-out mechanism

**Plausible Analytics:** Cookie-free olduğu için GDPR/CCPA uyumlu, banner gerekmez

### 4. GDPR Compliance (EU users)

**Gerekli:**
- ✅ Privacy policy
- ✅ Açık consent (waitlist form checkbox)
- ✅ Data access/deletion mechanism
- ✅ Data processor agreements (Brevo = GDPR compliant)

**Waitlist Form Eklentisi:**
```typescript
<label className="flex items-center gap-2">
  <input type="checkbox" required />
  <span className="text-sm text-gray-600">
    I agree to receive product updates and accept the{' '}
    <a href="/privacy" className="underline">Privacy Policy</a>
  </span>
</label>
```

### 5. OAuth App Requirements (Google/GitHub)

**Google OAuth:**
- ✅ Privacy Policy URL (required)
- ✅ Terms of Service URL (required)
- ✅ Homepage URL
- ✅ Support email
- ✅ Logo (120x120px min)

**GitHub OAuth:**
- ✅ Authorization callback URL
- ✅ Homepage URL (optional but recommended)

---

## 📊 Analytics & Monitoring

### Plausible Setup

```typescript
// app/layout.tsx (already included above)
<script
  defer
  data-domain="gettruxe.dev"
  src="https://plausible.io/js/script.js"
/>
```

**Plausible.io Dashboard:**
1. Sign up: https://plausible.io
2. Add site: gettruxe.dev
3. Free for self-hosted, $9/mo for cloud

**Tracked automatically:**
- Page views
- Referrers
- Devices
- Countries
- NO cookies
- NO personal data

### Custom Events (Optional)

```typescript
// Track waitlist submissions
declare global {
  interface Window {
    plausible?: (event: string, options?: { props: Record<string, any> }) => void
  }
}

// In waitlist form
const handleSubmit = async () => {
  // ... submit logic

  window.plausible?.('Waitlist Signup', {
    props: { useCase: selectedUseCase }
  })
}
```

---

## 🎯 Launch Checklist

### Pre-Launch
- [ ] All pages implemented (home, privacy, terms, support)
- [ ] Waitlist form connected to Brevo
- [ ] Analytics (Plausible) installed
- [ ] SEO metadata complete
- [ ] OG image created (1200x630)
- [ ] Favicon/logo added
- [ ] Mobile responsive tested
- [ ] Browser compatibility checked (Chrome, Firefox, Safari)
- [ ] Performance optimization (Lighthouse score >90)
- [ ] Legal pages reviewed

### Domain & Hosting
- [ ] Domain DNS configured
- [ ] SSL certificate active (HTTPS)
- [ ] Vercel/server deployment complete
- [ ] Environment variables set
- [ ] Email deliverability tested (Brevo)

### Testing
- [ ] Waitlist form submission works
- [ ] Email confirmation received
- [ ] All internal links work
- [ ] External links (Wundam) work
- [ ] Analytics tracking verified
- [ ] Mobile navigation works
- [ ] Forms accessible (keyboard navigation)

### Marketing
- [ ] Announcement post prepared
- [ ] Social media accounts (Twitter/X, LinkedIn)
- [ ] GitHub repo public (future)
- [ ] Product Hunt launch planned
- [ ] Email template for waitlist welcome

---

## 💡 Future Enhancements (Post-Launch)

### Phase 2 (After Initial Launch)
- [ ] Documentation site (separate or integrated)
- [ ] Blog/changelog
- [ ] Video demo/walkthrough
- [ ] Interactive code examples
- [ ] GitHub stars/watchers widget
- [ ] Testimonials section (when you have users)

### Phase 3 (Growth)
- [ ] Multi-language support
- [ ] Comparison pages (/vs/supabase, /vs/clerk)
- [ ] Pricing page (when product launches)
- [ ] Case studies
- [ ] API reference documentation
- [ ] SDK documentation

---

## 📞 Sorular & Destek

Bu dökümanla ilgili sorularınız için:
- **Email:** ozan.oke@wundam.com
- **Proje:** Truxe Website
- **Timeline:** ASAP (önerilen 1-2 hafta)

---

## 🎉 Özet

**Ne Yapıyoruz:**
Modern, single-page landing page for Truxe authentication service.

**Teknoloji:**
Next.js 14 + TailwindCSS + TypeScript + Framer Motion

**Özellikler:**
- Hero section with shield branding
- Feature showcase (9 core features)
- Competitor comparison (Supabase, Clerk, Auth0)
- Waitlist form (Brevo integration)
- Legal pages (Privacy, Terms, Support)
- Cookie-free analytics (Plausible)
- Wundam LLC branding

**Deployment:**
Vercel (recommended) or self-hosted via Docker

**Timeline:**
1-2 hafta (implement + test + launch)

**Next Steps:**
1. Yeni repo oluştur: `truxe-website`
2. Next.js initialize
3. Components/sections implement
4. Brevo integration
5. Deploy to Vercel
6. Domain configure
7. Launch! 🚀

---

**Başarılar! Bu dökümanla her detay elimizde. Projeyi açtığınızda bu referans üzerinden ilerleyebilirsiniz.** 🛡️
