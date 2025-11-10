"use client";

import { motion } from "framer-motion";
import { KeyRound, Shield, Code, FileText } from "lucide-react";

const BENEFITS = [
  {
    icon: KeyRound,
    title: "SSO/OIDC",
    subtitle: "One-click entry across apps",
    description:
      "Single sign-on with OAuth 2.0 and OpenID Connect. Use Truxe as your identity provider or connect existing ones.",
    features: ["Google, GitHub, Azure AD", "Custom OIDC providers", "PKCE flow support"],
  },
  {
    icon: Shield,
    title: "RBAC/Policy",
    subtitle: "Roles and rules that scale",
    description:
      "Granular permission system with resource-level policies. Multi-tenant support with organization-scoped access control.",
    features: ["Custom roles & permissions", "Policy-based authorization", "Tenant isolation"],
  },
  {
    icon: Code,
    title: "SDK/CLI",
    subtitle: "Dev-friendly by default",
    description:
      "Type-safe SDKs for JavaScript, Python, and Go. Production-ready code snippets and comprehensive API documentation.",
    features: ["Full TypeScript support", "Auto-generated clients", "CLI tools included"],
  },
  {
    icon: FileText,
    title: "Audit",
    subtitle: "Every access, accounted for",
    description:
      "Complete audit trail of all authentication events, permission changes, and security incidents with real-time monitoring.",
    features: ["Real-time event logs", "Security incident alerts", "Compliance reports"],
  },
] as const;

export function QuickBenefits() {
  return (
    <section className="container-custom section-padding bg-gradient-to-b from-primary-light/5 to-white">
      <div className="space-y-12">
        {/* Header */}
        <div className="space-y-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Core Capabilities
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <p className="text-lg text-muted md:mx-auto md:max-w-2xl">
              Purpose-built for developers who need enterprise-grade security
              without enterprise-grade complexity.
            </p>
          </motion.div>
        </div>

        {/* Benefits Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="card group h-full space-y-4 bg-white p-6 shadow-soft transition-all hover:shadow-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <benefit.icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {benefit.title}
                  </h3>
                  <p className="text-sm font-medium text-primary">
                    {benefit.subtitle}
                  </p>
                </div>
                <p className="text-sm text-muted">{benefit.description}</p>
                <ul className="space-y-1 border-t border-border pt-3">
                  {benefit.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-xs text-muted"
                    >
                      <span className="h-1 w-1 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={`/docs/${benefit.title.toLowerCase().replace("/", "-")}`}
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Learn more →
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
