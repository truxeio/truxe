"use client";

import Link from "next/link";
import { ArrowLeft, Shield, Bell } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-primary-light/10">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container-custom py-4">
          <Link href="/docs" className="text-primary hover:underline inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Documentation
          </Link>
        </div>
      </header>

      <main className="container-custom max-w-4xl space-y-12 py-16">
        <section className="space-y-6 text-center">
          <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4">
            <Shield className="h-12 w-12 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Security Best Practices
          </h1>
          <p className="text-lg text-muted mx-auto max-w-2xl">
            Comprehensive security documentation and best practices guide is coming soon. Join the waitlist to get notified when it's ready.
          </p>
        </section>

        <section className="card bg-gradient-to-br from-primary/5 to-primary/10 p-12 text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">
              Coming Soon
            </h2>
          </div>
          <p className="text-muted max-w-2xl mx-auto">
            We're creating detailed security documentation covering token management, session security, MFA configuration, threat monitoring, environment setup, and production deployment checklists.
          </p>
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-white transition hover:bg-primary-dark"
          >
            Join Waitlist for Updates
          </Link>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground text-center">Security Resources</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/trust" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Trust Center →
              </h3>
              <p className="text-sm text-muted">
                Learn about our security and compliance
              </p>
            </Link>

            <Link href="/docs/quickstart" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Quickstart Guide →
              </h3>
              <p className="text-sm text-muted">
                Get started with secure defaults
              </p>
            </Link>

            <Link href="/docs/api" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                API Reference →
              </h3>
              <p className="text-sm text-muted">
                Learn about authentication endpoints
              </p>
            </Link>

            <a
              href="https://github.com/wundam/truxe"
              target="_blank"
              rel="noopener noreferrer"
              className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group"
            >
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                GitHub Security →
              </h3>
              <p className="text-sm text-muted">
                View security advisories and policies
              </p>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
