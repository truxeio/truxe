"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  Lock,
  FileCheck,
  Activity,
  Bell,
  ExternalLink,
  CheckCircle,
} from "lucide-react";

const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description:
      "All data encrypted at rest (AES-256) and in transit (TLS 1.3). Password hashing with bcrypt (cost factor 12).",
  },
  {
    icon: Shield,
    title: "Secure Authentication",
    description:
      "JWT with JTI revocation, Redis-backed session storage, automatic token rotation with 15-minute access tokens.",
  },
  {
    icon: FileCheck,
    title: "Data Isolation",
    description:
      "Multi-tenant architecture with complete data isolation per organization. No shared database rows.",
  },
  {
    icon: Activity,
    title: "Security Monitoring",
    description:
      "Real-time threat detection, device fingerprinting, and anomaly detection with automated alerts.",
  },
] as const;

const COMPLIANCE = [
  {
    title: "GDPR Compliant",
    status: "active",
    description:
      "Full compliance with EU General Data Protection Regulation. Data processing agreements available.",
  },
  {
    title: "KVKK Ready",
    status: "active",
    description:
      "Aligned with Turkish Personal Data Protection Law (KVKK) requirements.",
  },
  {
    title: "SOC 2 Type II",
    status: "in-progress",
    description: "Security audit in progress.",
  },
  {
    title: "ISO 27001",
    status: "planned",
    description:
      "Information security management certification planned for 2025.",
  },
] as const;

const TRUST_RESOURCES = [
  {
    title: "Security Overview",
    description: "Detailed security architecture and practices",
    href: "/trust#security",
  },
  {
    title: "Data Processing Agreement",
    description: "GDPR-compliant DPA for enterprise customers",
    href: "/trust/dpa",
  },
  {
    title: "Subprocessors",
    description: "List of third-party service providers",
    href: "/trust/subprocessors",
  },
  {
    title: "System Status",
    description: "Real-time uptime and incident history",
    href: "https://status.truxe.dev",
    external: true,
  },
  {
    title: "Security Disclosure",
    description: "Responsible vulnerability reporting",
    href: "/trust#disclosure",
  },
] as const;

export default function TrustCenter() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-primary-light/10">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container-custom py-4">
          <Link href="/" className="text-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="container-custom space-y-20 py-16">
        {/* Hero */}
        <section className="space-y-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4">
              <Shield className="h-12 w-12 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Trust Center
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
              Your security and privacy are our top priorities. Learn how we
              protect your data and maintain compliance.
            </p>
          </motion.div>
        </section>

        {/* Security Features */}
        <section id="security" className="space-y-8">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Security Overview
            </h2>
            <p className="mx-auto max-w-2xl text-muted">
              Enterprise-grade security built into every layer of our platform
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {SECURITY_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card bg-white p-6 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted">{feature.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Compliance */}
        <section className="space-y-8">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Compliance & Certifications
            </h2>
            <p className="mx-auto max-w-2xl text-muted">
              We maintain rigorous compliance standards to protect your business
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {COMPLIANCE.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card bg-white p-6 shadow-soft"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted">{item.description}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      item.status === "active"
                        ? "bg-success/10 text-success"
                        : item.status === "in-progress"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/10 text-muted"
                    }`}
                  >
                    {item.status === "active"
                      ? "Active"
                      : item.status === "in-progress"
                        ? "In Progress"
                        : "Planned"}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trust Resources */}
        <section className="space-y-8">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Trust Resources
            </h2>
            <p className="mx-auto max-w-2xl text-muted">
              Access detailed documentation about our security and compliance practices
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRUST_RESOURCES.map((resource, index) => (
              <motion.div
                key={resource.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <Link
                  href={resource.href}
                  target={"external" in resource && resource.external ? "_blank" : undefined}
                  rel={"external" in resource && resource.external ? "noopener noreferrer" : undefined}
                  className="card block h-full bg-white p-6 shadow-soft transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground">
                        {resource.title}
                      </h3>
                      <p className="text-sm text-muted">
                        {resource.description}
                      </p>
                    </div>
                    {"external" in resource && resource.external && (
                      <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Responsible Disclosure */}
        <section
          id="disclosure"
          className="card bg-gradient-to-br from-primary/5 to-primary/10 p-8"
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bell className="h-6 w-6" strokeWidth={2} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Responsible Security Disclosure
                </h2>
                <p className="text-muted">
                  We take security seriously. If you've discovered a security
                  vulnerability, please report it to us responsibly.
                </p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl bg-white/80 p-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="font-semibold text-foreground">
                  Email us at:
                </span>
                <a
                  href="mailto:security@wundam.com"
                  className="font-mono text-primary hover:underline"
                >
                  security@wundam.com
                </a>
              </div>
              <p className="text-sm text-muted">
                We commit to acknowledging your report within 24 hours and
                providing updates throughout our investigation. Responsible
                disclosure reports may be eligible for recognition in our Hall
                of Fame.
              </p>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="text-center">
          <div className="card inline-block bg-white p-8 shadow-soft">
            <h3 className="mb-2 text-2xl font-bold text-foreground">
              Questions about security?
            </h3>
            <p className="mb-4 text-muted">
              Our team is here to help with any security or compliance questions.
            </p>
            <a
              href="mailto:security@wundam.com"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-dark"
            >
              Contact Security Team
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
