"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Book, Code, Zap, Shield, ArrowRight } from "lucide-react";

const DOC_SECTIONS = [
  {
    title: "Quickstart",
    description: "Get up and running with Truxe in under 10 minutes",
    icon: Zap,
    href: "/docs/quickstart",
    topics: [
      "Installation & Setup",
      "First Authentication",
      "Basic Configuration",
      "Testing Your Setup",
    ],
  },
  {
    title: "SDK Documentation",
    description: "Complete API reference for all supported languages",
    icon: Code,
    href: "/docs/sdk",
    topics: [
      "JavaScript/TypeScript SDK",
      "Python SDK",
      "Go SDK",
      "Authentication Methods",
    ],
  },
  {
    title: "API Reference",
    description: "Comprehensive REST API documentation",
    icon: Book,
    href: "/docs/api",
    topics: [
      "Authentication Endpoints",
      "OAuth Provider API",
      "RBAC & Permissions",
      "Webhooks & Events",
    ],
  },
  {
    title: "Security Best Practices",
    description: "Learn how to secure your Truxe deployment",
    icon: Shield,
    href: "/docs/security",
    topics: [
      "Token Management",
      "Session Security",
      "MFA Configuration",
      "Threat Monitoring",
    ],
  },
] as const;

export default function DocsPage() {
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

      <main className="container-custom space-y-16 py-16">
        {/* Hero */}
        <section className="space-y-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Truxe Documentation
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
              Everything you need to integrate, deploy, and scale Truxe in your
              applications
            </p>
          </motion.div>

          {/* Search bar placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto max-w-2xl"
          >
            <div className="card bg-white p-4 shadow-soft">
              <input
                type="search"
                placeholder="Search documentation..."
                className="w-full border-none bg-transparent text-foreground placeholder:text-muted focus:outline-none"
                disabled
              />
              <p className="mt-2 text-xs text-muted">
                Full documentation coming soon. Join the waitlist for early
                access.
              </p>
            </div>
          </motion.div>
        </section>

        {/* Doc Sections */}
        <section className="grid gap-8 md:grid-cols-2">
          {DOC_SECTIONS.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link
                href={section.href}
                className="card group block h-full bg-white p-8 shadow-soft transition-all hover:shadow-lg"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <section.icon className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <ArrowRight className="h-5 w-5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">
                      {section.title}
                    </h2>
                    <p className="text-muted">{section.description}</p>
                  </div>

                  <ul className="space-y-2 border-t border-border pt-4">
                    {section.topics.map((topic) => (
                      <li
                        key={topic}
                        className="flex items-center gap-2 text-sm text-muted"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              </Link>
            </motion.div>
          ))}
        </section>

        {/* Additional Resources */}
        <section className="space-y-8">
          <h2 className="text-center text-3xl font-bold text-foreground">
            Additional Resources
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="card bg-white p-6 text-center shadow-soft">
              <h3 className="mb-2 font-semibold text-foreground">
                GitHub Examples
              </h3>
              <p className="mb-4 text-sm text-muted">
                Sample projects and integration examples
              </p>
              <a
                href="https://github.com/wundam/truxe-examples"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                View Examples →
              </a>
            </div>

            <div className="card bg-white p-6 text-center shadow-soft">
              <h3 className="mb-2 font-semibold text-foreground">
                Community Forum
              </h3>
              <p className="mb-4 text-sm text-muted">
                Get help from the community
              </p>
              <a
                href="https://discord.gg/truxe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                Join Discord →
              </a>
            </div>

            <div className="card bg-white p-6 text-center shadow-soft">
              <h3 className="mb-2 font-semibold text-foreground">
                Support
              </h3>
              <p className="mb-4 text-sm text-muted">
                Need help? Contact our team
              </p>
              <a
                href="mailto:support@truxe.io"
                className="text-sm font-medium text-primary hover:underline"
              >
                Get Support →
              </a>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="card bg-gradient-to-br from-primary/5 to-primary/10 p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground">
            Documentation Coming Soon
          </h2>
          <p className="mb-6 text-muted">
            We're working hard to create comprehensive documentation. Join the
            waitlist to get notified when it's ready.
          </p>
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-white transition hover:bg-primary-dark"
          >
            Join Waitlist
          </Link>
        </section>
      </main>
    </div>
  );
}
