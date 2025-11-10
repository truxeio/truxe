"use client";

import Link from "next/link";
import { ArrowLeft, Code2 } from "lucide-react";

export default function SDKPage() {
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
        <section className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            SDK Documentation
          </h1>
          <p className="text-lg text-muted">
            Official SDKs and client libraries for integrating Truxe into your applications.
          </p>
        </section>

        <section className="card bg-primary/5 p-8 space-y-4">
          <div className="flex items-center gap-3">
            <Code2 className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">SDKs Coming Soon</h2>
          </div>
          <p className="text-muted">
            We're currently developing official SDKs for JavaScript/TypeScript, Python, Go, and more.
            Join the waitlist to be notified when they're ready.
          </p>
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-dark"
          >
            Join Waitlist
          </Link>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Planned SDKs</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card bg-white p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-foreground mb-3">@truxe/js</h3>
              <p className="text-sm text-muted mb-4">
                Universal JavaScript SDK for Node.js, browser, and edge runtimes with full TypeScript support.
              </p>
              <div className="inline-block bg-warning/15 text-warning px-3 py-1 rounded-full text-xs font-semibold">
                In Development
              </div>
            </div>

            <div className="card bg-white p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-foreground mb-3">@truxe/react</h3>
              <p className="text-sm text-muted mb-4">
                React component library with 16+ pre-built components for authentication, users, and organizations.
              </p>
              <div className="inline-block bg-warning/15 text-warning px-3 py-1 rounded-full text-xs font-semibold">
                In Development
              </div>
            </div>

            <div className="card bg-white p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-foreground mb-3">truxe-python</h3>
              <p className="text-sm text-muted mb-4">
                Python SDK for backend applications with async/await support and type hints.
              </p>
              <div className="inline-block bg-muted/30 text-muted px-3 py-1 rounded-full text-xs font-semibold">
                Planned
              </div>
            </div>

            <div className="card bg-white p-6 shadow-soft">
              <h3 className="text-lg font-semibold text-foreground mb-3">truxe-go</h3>
              <p className="text-sm text-muted mb-4">
                Go SDK optimized for high-performance backend services and microservices.
              </p>
              <div className="inline-block bg-muted/30 text-muted px-3 py-1 rounded-full text-xs font-semibold">
                Planned
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Current API Usage</h2>
          <p className="text-muted">
            While SDKs are in development, you can use the REST API directly:
          </p>

          <div className="card bg-white p-6 shadow-soft space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Example: Magic Link Authentication</h3>
            <div className="card bg-slate-950 p-6 overflow-x-auto">
              <pre className="text-sm text-slate-200">
                <code>{`// Send magic link
const response = await fetch('https://api.truxe.io/auth/magic-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// Verify token from magic link
const { accessToken, refreshToken } = await response.json();

// Use access token for authenticated requests
const userResponse = await fetch('https://api.truxe.io/auth/me', {
  headers: { 'Authorization': \`Bearer \${accessToken}\` }
});

const user = await userResponse.json();
console.log(user);`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Related Documentation</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/docs/api" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                API Reference →
              </h3>
              <p className="text-sm text-muted">
                Complete REST API documentation with all endpoints
              </p>
            </Link>

            <Link href="/docs/quickstart" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Quickstart Guide →
              </h3>
              <p className="text-sm text-muted">
                Get started with Truxe in under 10 minutes
              </p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
