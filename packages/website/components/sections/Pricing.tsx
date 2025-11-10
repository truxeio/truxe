"use client";

import { motion } from "framer-motion";
import { Check, X, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";

const TIERS = [
  {
    name: "Community",
    price: "Free",
    period: undefined,
    description: "Perfect for side projects and learning",
    license: "MIT License",
    features: [
      "Magic Link Authentication",
      "Password Authentication",
      "Basic OAuth (Google, GitHub)",
      "Basic Sessions & Organizations",
      "Basic RBAC",
      "Community Support",
      "Self-hosted (unlimited users)",
    ],
    limitations: [
      "No OAuth Provider",
      "No Passkeys/WebAuthn",
      "No SAML SSO",
      "No Priority Support",
    ],
    cta: "Get Started",
    ctaVariant: "secondary" as const,
    popular: false,
  },
  {
    name: "Professional",
    price: "$79",
    period: "/month",
    description: "For startups and growing teams (production use)",
    license: "BSL 1.1 License (FREE for dev/test)",
    badge: "Most Popular",
    features: [
      "Everything in Community, plus:",
      "🔌 OAuth Provider (Login with Truxe)",
      "📱 Multi-Factor Authentication (TOTP)",
      "🐙 GitHub Integration (7 endpoints)",
      "🔔 Webhooks & Event System",
      "🛡️ Advanced Security Monitoring",
      "👤 Service Accounts & API Keys",
      "📊 Admin Dashboard",
      "⚡ Advanced RBAC & Permissions",
      "📧 Email Support",
      "Self-hosted (unlimited users)",
    ],
    limitations: [
      "No Passkeys/WebAuthn (coming soon)",
      "No SAML SSO",
      "No SCIM Directory Sync",
      "No SLA",
    ],
    cta: "Start Free Trial",
    ctaVariant: "primary" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$499",
    period: "/month",
    description: "For large organizations with compliance needs (production use)",
    license: "BSL 1.1 License (FREE for dev/test)",
    features: [
      "Everything in Professional, plus:",
      "🔐 Passkeys/WebAuthn (coming soon)",
      "🏢 SAML 2.0 SSO (coming soon)",
      "🔄 SCIM 2.0 Directory Sync (coming soon)",
      "🤖 AI-Powered Anomaly Detection",
      "📋 Compliance Automation (GDPR, SOC 2, HIPAA)",
      "📈 Advanced Analytics & Insights",
      "✅ 99.9% SLA",
      "🚨 Priority Support (24/7)",
      "👨‍💼 Dedicated Account Manager",
      "📝 Custom Contract Terms",
    ],
    limitations: [],
    cta: "Contact Sales",
    ctaVariant: "secondary" as const,
    popular: false,
  },
] as const;

export function Pricing() {
  const handleCTA = (tierName: string) => {
    if (tierName === "Enterprise") {
      window.location.href =
        "mailto:sales@wundam.com?subject=Truxe Enterprise Inquiry";
      return;
    }

    if (tierName === "Professional") {
      document
        .querySelector("#waitlist")
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    alert("Documentation coming soon! Join the waitlist to get early access.");
  };

  return (
    <section
      id="pricing"
      className="container-custom section-padding space-y-12"
    >
      <div className="space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Transparent Pricing
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Open Core Pricing: Free to Start, Scale When Ready
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className="text-lg text-muted md:mx-auto md:max-w-3xl">
            Community Edition is free forever. Professional/Enterprise features are free for
            development and testing—you only pay ($79-$499/month flat) when deploying to production.
            No per-user pricing, scale with confidence.
          </p>
        </motion.div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {TIERS.map((tier, index) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="relative pt-8"
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                  <Sparkles className="h-3 w-3" />
                  {tier.badge}
                </span>
              </div>
            )}
            <div
              className={`card h-full space-y-6 p-8 ${
                tier.popular
                  ? "border-2 border-primary shadow-lg"
                  : "border border-border shadow-soft"
              } bg-white`}
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">
                  {tier.name}
                </h3>
                <p className="text-sm text-muted">{tier.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-muted">{tier.period}</span>
                  )}
                </div>
                <p className="text-xs text-muted">{tier.license}</p>
              </div>

              <Button
                variant={tier.ctaVariant}
                className="w-full"
                onClick={() => handleCTA(tier.name)}
              >
                {tier.cta}
              </Button>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Included:
                </p>
                <ul className="space-y-2">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-5 w-5 shrink-0 text-success" />
                      <span className="text-muted">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {tier.limitations.length > 0 && (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-muted">
                    Not included:
                  </p>
                  <ul className="space-y-2">
                    {tier.limitations.map((limitation) => (
                      <li
                        key={limitation}
                        className="flex items-start gap-2 text-sm"
                      >
                        <X className="h-5 w-5 shrink-0 text-muted/40" />
                        <span className="text-muted/60">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mx-auto max-w-3xl space-y-6"
      >
        <h3 className="text-center text-2xl font-bold text-foreground">
          Frequently Asked Questions
        </h3>

        <div className="space-y-4">
          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>Why $79/month? What makes Professional tier worth it?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p>
                Professional tier includes <strong>unique features</strong> not available in most auth providers:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li><strong>OAuth Provider (Login with Truxe)</strong> - Let other apps use your auth (most competitors don't have this)</li>
                <li><strong>GitHub Integration (7 endpoints)</strong> - Auto-create repos, sync permissions, trigger actions (NO ONE else has this!)</li>
                <li><strong>Full MFA with TOTP</strong> - Google Authenticator, Authy support with backup codes</li>
                <li><strong>Webhooks & Events</strong> - Real-time notifications for all auth events</li>
                <li><strong>Advanced Security</strong> - Threat detection, device fingerprinting, anomaly alerts</li>
                <li><strong>No per-user pricing</strong> - $79/month for unlimited users (competitors charge thousands at scale!)</li>
              </ul>
            </div>
          </details>

          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>How much can I save compared to other auth services?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 text-sm text-muted">
              <p className="mb-3">
                Most auth providers charge per monthly active user (MAU). At scale, this adds up quickly:
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="mb-1 text-xs font-semibold text-red-900">Typical Provider</p>
                  <p className="text-2xl font-bold text-red-600">$2K-$23K</p>
                  <p className="text-xs text-red-700">/month at 100K users</p>
                </div>
                <div className="rounded-xl border border-success bg-success/10 p-4">
                  <p className="mb-1 text-xs font-semibold text-success">Truxe Pro</p>
                  <p className="text-2xl font-bold text-success">$79</p>
                  <p className="text-xs text-success">/month (unlimited users)</p>
                </div>
              </div>
              <p className="mt-3 font-semibold text-success">
                💰 Save up to $22,921/month compared to enterprise-tier providers!
              </p>
            </div>
          </details>

          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>Do you have a free trial?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 text-sm text-muted">
              <p>
                Yes! Community Edition (MIT License) is <strong>FREE forever</strong> with basic auth features.
                Professional/Enterprise features are also <strong>FREE for development and testing</strong> - no license required!
              </p>
              <p className="mt-2">
                You only need a paid license ($79-$499/month) when deploying Professional/Enterprise features to production.
                Try everything risk-free in your dev environment first.
              </p>
            </div>
          </details>

          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>Can I switch between tiers?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 text-sm text-muted">
              <p>
                Absolutely! You can upgrade or downgrade anytime. When you upgrade, new features are immediately available.
                When you downgrade, you'll keep access until the end of your billing period.
              </p>
            </div>
          </details>

          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>Is my data locked into Truxe?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 text-sm text-muted">
              <p>
                <strong>No vendor lock-in!</strong> Truxe is self-hosted, so your data stays in YOUR infrastructure.
                You can export all data anytime, and the Community Edition (MIT) will always be open-source and free.
              </p>
              <p className="mt-2">
                Even Professional/Enterprise (BSL) converts to MIT License after 4 years, ensuring long-term availability.
              </p>
            </div>
          </details>

          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>What's the difference between Community and Professional?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 text-sm text-muted">
              <p><strong>Community (MIT - Free forever):</strong></p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Magic Link + Password Auth</li>
                <li>Basic OAuth consumer (Google, GitHub login)</li>
                <li>Basic RBAC & Organizations</li>
                <li>FREE for all uses (personal, commercial, production)</li>
              </ul>
              <p className="mt-2"><strong>Professional (BSL - $79/month for production):</strong></p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Everything in Community, PLUS:</li>
                <li>OAuth Provider (let others "Login with YourApp")</li>
                <li>MFA (TOTP), GitHub Integration, Webhooks</li>
                <li>Advanced security, service accounts, admin dashboard</li>
                <li>FREE for development/testing, paid for production</li>
              </ul>
            </div>
          </details>

          <details className="card group cursor-pointer bg-white p-6">
            <summary className="flex items-center justify-between font-semibold text-foreground">
              <span>What makes Truxe different from other auth providers?</span>
              <span className="text-primary transition group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 text-sm text-muted">
              <p className="mb-3">Truxe stands out with features no one else offers:</p>
              <ul className="ml-4 list-disc space-y-2">
                <li>
                  <strong>GitHub Integration (7 endpoints)</strong> - Unique to Truxe! Auto-create repos,
                  sync permissions with GitHub orgs, trigger Actions on auth events
                </li>
                <li>
                  <strong>OAuth Provider built-in</strong> - Most open-source solutions are consumers only.
                  Truxe lets you offer "Login with YourApp" to other services
                </li>
                <li>
                  <strong>Flat pricing + self-hosted</strong> - Unlike cloud-only providers that charge per user,
                  you pay $79/month regardless of scale
                </li>
                <li>
                  <strong>Open Core model</strong> - Core features MIT licensed (free forever),
                  advanced features BSL (converts to MIT after 4 years)
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted/80">
                Compare: Most managed services charge $2K-$23K/month at 100K users.
                Most open-source options lack OAuth Provider and GitHub integration.
              </p>
            </div>
          </details>
        </div>
      </motion.div>

      {/* Legal Disclaimer */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-12 text-center"
      >
        <p className="text-xs text-muted/70">
          * Pricing and features are subject to change. All BSL-licensed features are free for development and testing.
          Production deployment requires a valid license. Features marked "coming soon" are under active development
          and availability timelines may vary. See our{" "}
          <a href="/terms" className="text-primary hover:underline">Terms of Service</a> for details.
        </p>
      </motion.div>

    </section>
  );
}
