"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const FEATURE_CATEGORIES = [
  {
    category: "🔐 Authentication",
    features: [
      {
        icon: "🔐",
        title: "Magic Link Authentication",
        description: "Passwordless auth via email for a secure, frictionless UX.",
        tech: "JWT-based with 15 minute expiry windows.",
        badge: "Free",
      },
      {
        icon: "📱",
        title: "Multi-Factor Authentication",
        description: "TOTP support for Google Authenticator, Authy, and more.",
        tech: "Encrypted secrets with hashed backup codes.",
        badge: "Pro",
      },
      {
        icon: "🔑",
        title: "OAuth 2.0 Consumer",
        description: "Google, GitHub, and more with PKCE flow support out of the box.",
        tech: "Device fingerprinting baked into every handshake.",
        badge: "Free",
      },
      {
        icon: "🔌",
        title: "OAuth 2.0 Provider",
        description: "Enable 'Login with Truxe' for third-party applications.",
        tech: "Full authorization code flow with PKCE support, JWKS endpoints.",
        badge: "Unique",
      },
    ],
  },
  {
    category: "⚡ Authorization & Access",
    features: [
      {
        icon: "⚡",
        title: "Advanced Session Management",
        description: "JWT + JTI revocation, Redis-backed storage, and concurrency controls.",
        tech: "15 min access tokens with 7 day refresh rotation.",
        badge: "Pro",
      },
      {
        icon: "👥",
        title: "Role-Based Access Control",
        description: "Granular permissions, organization roles, and multi-tenancy.",
        tech: "Resource-level policies with isolation per tenant.",
        badge: "Free",
      },
      {
        icon: "🏢",
        title: "Organization Management",
        description: "Multi-tenant orgs with invitations, audits, and scoped access.",
        tech: "Isolated contexts with shared infrastructure.",
        badge: "Free",
      },
    ],
  },
  {
    category: "🛡️ Security & Monitoring",
    features: [
      {
        icon: "🛡️",
        title: "Security Monitoring",
        description: "Real-time detection for suspicious activity with proactive alerts.",
        tech: "Email, webhook, and in-app notification channels.",
        badge: "Pro",
      },
      {
        icon: "📊",
        title: "Device Fingerprinting",
        description: "Track devices and surface anomalies that threaten your accounts.",
        tech: "Browser, OS, and location heuristics.",
        badge: "Pro",
      },
      {
        icon: "🔄",
        title: "Automatic Token Rotation",
        description: "Sliding window refresh tokens for zero-downtime experiences.",
        tech: "Auto-rotating refresh strategy.",
        badge: "Pro",
      },
    ],
  },
  {
    category: "🔌 Developer Tools",
    features: [
      {
        icon: "🐙",
        title: "GitHub Integration",
        description: "Complete GitHub workflow automation—repos, actions, webhooks, and templates.",
        tech: "7 dedicated endpoints for seamless CI/CD integration.",
        badge: "Unique",
      },
      {
        icon: "🔔",
        title: "Webhooks & Events",
        description: "Real-time event notifications with comprehensive webhook testing.",
        tech: "Configurable endpoints with retry logic and payload validation.",
        badge: "Pro",
      },
      {
        icon: "📦",
        title: "React Component Library",
        description: "16 ready-to-use components for auth, users, and organizations.",
        tech: "SignIn, UserProfile, OrganizationSwitcher and more with TypeScript support.",
        badge: "Pro",
      },
    ],
  },
] as const;

const COMING_SOON_FEATURES = [
  {
    icon: "🛠️",
    title: "JavaScript SDK",
    description: "Universal SDK for Node.js, browser, and edge runtimes.",
    tech: "TypeScript-first with full type safety.",
    tier: "Professional",
  },
  {
    icon: "🔐",
    title: "Passkeys/WebAuthn",
    description: "Future-proof authentication with FIDO2 standard.",
    tech: "Biometric auth with platform authenticators.",
    tier: "Professional",
  },
  {
    icon: "🏢",
    title: "SAML 2.0 SSO",
    description: "Enterprise single sign-on with major identity providers.",
    tech: "Okta, Azure AD, Google Workspace integration.",
    tier: "Enterprise",
  },
  {
    icon: "🔄",
    title: "SCIM Directory Sync",
    description: "Automated user provisioning and deprovisioning.",
    tech: "SCIM 2.0 protocol with real-time sync.",
    tier: "Enterprise",
  },
] as const;

export function Features() {
  const [activeTab, setActiveTab] = useState<"available" | "coming">(
    "available",
  );

  const getBadgeStyle = (badge: string) => {
    if (badge === "Free") return "bg-success/15 text-success border-success/30";
    if (badge === "Pro") return "bg-primary/15 text-primary border-primary/30";
    if (badge === "Unique") return "bg-warning/15 text-warning border-warning/30";
    return "bg-muted/15 text-muted border-muted/30";
  };

  return (
    <section
      id="features"
      className="container-custom section-padding space-y-12"
    >
      <div className="space-y-4 text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Why Truxe
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Enterprise security with startup agility
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className="text-lg text-muted md:max-w-3xl">
            Authentication, authorization, and security monitoring—all in one
            developer-first platform that you can run anywhere.
          </p>
        </motion.div>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-border bg-white p-1">
          <button
            onClick={() => setActiveTab("available")}
            className={`rounded-lg px-6 py-2 text-sm font-medium transition ${
              activeTab === "available"
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
            type="button"
          >
            Available Now
          </button>
          <button
            onClick={() => setActiveTab("coming")}
            className={`rounded-lg px-6 py-2 text-sm font-medium transition ${
              activeTab === "coming"
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground"
            }`}
            type="button"
          >
            Coming Soon
          </button>
        </div>
      </div>

      {activeTab === "available" ? (
        <div className="space-y-12">
          {FEATURE_CATEGORIES.map((category, categoryIndex) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: categoryIndex * 0.1 }}
              className="space-y-6"
            >
              <h3 className="text-2xl font-bold text-foreground">
                {category.category}
              </h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {category.features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <div className={`card backdrop-blur-sm shadow-soft h-full space-y-4 bg-white/90 p-6 ${feature.badge === "Unique" ? "border-2 border-warning/30" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-4xl">{feature.icon}</span>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeStyle(feature.badge)}`}>
                          {feature.badge}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-foreground text-left">
                        {feature.title}
                      </h3>
                      <p className="text-base text-muted text-left">{feature.description}</p>
                      <p className="text-sm font-medium text-primary text-left">{feature.tech}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON_FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <div className="card backdrop-blur-sm shadow-soft h-full space-y-4 bg-white/90 p-6 text-center">
                <div className="flex items-center justify-center">
                  <span className="text-4xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-base text-muted">{feature.description}</p>
                <p className="text-sm font-medium text-primary">{feature.tech}</p>
                {"tier" in feature && (
                  <p className="text-xs text-muted">
                    Available in: <strong>{feature.tier}</strong>
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
