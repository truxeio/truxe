const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://truxe.io";

export const SITE_CONFIG = {
  name: "Truxe",
  description:
    "Authentication & Authorization Built for Developers. Open-source, self-hosted, and enterprise-ready without the vendor lock-in.",
  tagline: "Enterprise-grade auth you can actually control.",
  url: SITE_URL,
  ogImage: `${SITE_URL}/og-image.png`,
  waitlistCta: "Join Waitlist",
  docsCta: "View Documentation",
  links: {
    wundam: "https://wundam.com",
    hippoc: "https://hippoc.io",
    github: "https://github.com/truxeio/truxe",
    email: "support@truxe.io",
    privacy: "/privacy",
    terms: "/terms",
    support: "/support",
  },
  contact: {
    email: "support@truxe.io",
    privacy: "privacy@truxe.io",
  },
} as const;

export const NAV_ITEMS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Trust Center", href: "/trust" },
  { label: "Docs", href: "/docs" },
] as const;

export const PROBLEM_POINTS = [
  {
    vendor: "Managed Cloud Services",
    description:
      "Great for quick starts, but you inherit vendor lock-in and limited control over your data and infrastructure.",
  },
  {
    vendor: "UI-First Platforms",
    description:
      "Beautiful interfaces with per-user pricing models that can become expensive as your application scales.",
  },
  {
    vendor: "Enterprise Solutions",
    description:
      "Powerful feature sets but often come with complexity and steep learning curves that slow development.",
  },
] as const;

export const FEATURES = [
  {
    icon: "🔐",
    title: "Magic Link Authentication",
    description: "Passwordless auth via email for a secure, frictionless UX.",
    tech: "JWT-based with 15 minute expiry windows.",
  },
  {
    icon: "📱",
    title: "Multi-Factor Authentication",
    description: "TOTP support for Google Authenticator, Authy, and more.",
    tech: "Encrypted secrets with hashed backup codes.",
  },
  {
    icon: "🔑",
    title: "OAuth 2.0 Providers",
    description: "Google, GitHub, and more with PKCE flow support out of the box.",
    tech: "Device fingerprinting baked into every handshake.",
  },
  {
    icon: "⚡",
    title: "Advanced Session Management",
    description: "JWT + JTI revocation, Redis-backed storage, and concurrency controls.",
    tech: "15 min access tokens with 7 day refresh rotation.",
  },
  {
    icon: "👥",
    title: "Role-Based Access Control",
    description: "Granular permissions, organization roles, and multi-tenancy.",
    tech: "Resource-level policies with isolation per tenant.",
  },
  {
    icon: "🛡️",
    title: "Security Monitoring",
    description: "Real-time detection for suspicious activity with proactive alerts.",
    tech: "Email, webhook, and in-app notification channels.",
  },
  {
    icon: "📊",
    title: "Device Fingerprinting",
    description: "Track devices and surface anomalies that threaten your accounts.",
    tech: "Browser, OS, and location heuristics.",
  },
  {
    icon: "🔄",
    title: "Automatic Token Rotation",
    description: "Sliding window refresh tokens for zero-downtime experiences.",
    tech: "Auto-rotating refresh strategy.",
  },
  {
    icon: "🏢",
    title: "Organization Management",
    description: "Multi-tenant orgs with invitations, audits, and scoped access.",
    tech: "Isolated contexts with shared infrastructure.",
  },
] as const;

export const COMPARISON_TABLE = {
  managed: {
    label: "Managed Cloud Providers",
    summary:
      "Managed services offer convenience, but Truxe provides control, transparency, and no vendor lock-in.",
    rows: [
      { feature: "Self-hosted", truxe: "✅ Full control", competitor: "⚠️ Limited" },
      { feature: "RBAC depth", truxe: "✅ Advanced", competitor: "⚠️ Basic" },
      { feature: "Security monitoring", truxe: "✅ Built-in", competitor: "⚠️ Limited" },
      { feature: "Threat detection", truxe: "✅ Included", competitor: "⚠️ Add-on" },
      { feature: "Pricing model", truxe: "💰 Open-source", competitor: "💰 Usage-based" },
      { feature: "Data ownership", truxe: "✅ Full", competitor: "⚠️ Shared" },
    ],
  },
  uiFirst: {
    label: "UI-First Platforms",
    summary:
      "UI-focused platforms ship fast; Truxe focuses on backend control, flexibility, and cost efficiency.",
    rows: [
      { feature: "Self-hosted", truxe: "✅ Yes", competitor: "❌ No" },
      { feature: "Pricing", truxe: "💰 Predictable", competitor: "💰 Per-user scaling" },
      { feature: "Customization", truxe: "✅ Full", competitor: "⚠️ Template-based" },
      { feature: "Security monitoring", truxe: "✅ Advanced", competitor: "⚠️ Basic" },
      { feature: "Data ownership", truxe: "✅ Yours", competitor: "⚠️ Theirs" },
      { feature: "Infrastructure", truxe: "✅ Your choice", competitor: "❌ Locked" },
    ],
  },
  enterprise: {
    label: "Enterprise Solutions",
    summary:
      "Enterprise tools are powerful but complex. Truxe delivers enterprise features with modern developer experience.",
    rows: [
      { feature: "Modern stack", truxe: "✅ Latest tech", competitor: "⚠️ Mixed legacy" },
      { feature: "Self-hosted", truxe: "✅ Yes", competitor: "⚠️ Premium tier" },
      { feature: "Developer UX", truxe: "✅ Clean API", competitor: "⚠️ Complex" },
      { feature: "Setup time", truxe: "⚡ Minutes", competitor: "⏱️ Hours/Days" },
      { feature: "Learning curve", truxe: "📖 Gentle", competitor: "📚 Steep" },
      { feature: "Vendor lock-in", truxe: "❌ None", competitor: "⚠️ High" },
    ],
  },
} as const;

export const ARCHITECTURE_POINTS = [
  {
    title: "Modern Backend",
    description: "Node.js + Fastify foundation tuned for low latency APIs.",
  },
  {
    title: "Battle-tested Storage",
    description: "PostgreSQL for relational data, Redis for blazing session speed.",
  },
  {
    title: "Security by Default",
    description: "Industry-standard encryption (bcrypt, JWT, TOTP) across the stack.",
  },
  {
    title: "Scale from Day One",
    description: "Stateless services and horizontal scaling patterns baked in.",
  },
  {
    title: "DevOps Ready",
    description: "Docker, health checks, and observability hooks available out of the box.",
  },
] as const;

export const USE_CASES = [
  {
    title: "SaaS Startups",
    description: "Ship multi-tenant apps with org-level permissions that scale cleanly.",
  },
  {
    title: "Developer Tools",
    description: "Offer APIs that require granular authorization without reinventing auth.",
  },
  {
    title: "Internal Platforms",
    description: "Empower enterprise teams with complex role hierarchies and audit trails.",
  },
  {
    title: "Privacy-first Products",
    description: "Keep auth in your own infrastructure for full data ownership.",
  },
] as const;

export const WAITLIST_BENEFITS = [
  "Early access to the beta and roadmap updates.",
  "Launch documentation and integration guides.",
  "Security feature releases before the general public.",
] as const;

export const WAITLIST_USE_CASES = [
  { label: "SaaS Product", value: "saas" },
  { label: "Internal Tool", value: "internal_tool" },
  { label: "API / Developer Tooling", value: "api" },
  { label: "Other", value: "other" },
] as const;

export const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/truxeio/truxe", icon: "github" },
  { label: "Discord", href: "https://discord.gg/truxe", icon: "discord" },
  { label: "Twitter/X", href: "https://x.com/truxeauth", icon: "twitter" },
  { label: "LinkedIn", href: "https://linkedin.com/company/truxe", icon: "linkedin" },
] as const;
