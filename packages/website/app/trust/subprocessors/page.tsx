"use client";

import Link from "next/link";
import { Server, Bell } from "lucide-react";

export default function SubprocessorsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-primary-light/10">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container-custom py-4">
          <Link href="/trust" className="text-primary hover:underline">
            ← Back to Trust Center
          </Link>
        </div>
      </header>

      <main className="container-custom max-w-4xl space-y-12 py-16">
        <section className="space-y-6 text-center">
          <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4">
            <Server className="h-12 w-12 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Subprocessors
          </h1>
          <p className="text-lg text-muted mx-auto max-w-2xl">
            List of third-party service providers used in Truxe operations.
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
            Our comprehensive subprocessors list will be available soon. We maintain transparency about all third-party services used to deliver Truxe.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:legal@wundam.com"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-white transition hover:bg-primary-dark"
            >
              Contact Legal Team
            </a>
            <Link
              href="/#waitlist"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-8 py-4 font-semibold text-primary transition hover:bg-primary hover:text-white"
            >
              Join Waitlist
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground text-center">Related Resources</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Link href="/trust" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Trust Center →
              </h3>
              <p className="text-sm text-muted">
                Security and compliance overview
              </p>
            </Link>

            <Link href="/trust/dpa" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Data Processing Agreement →
              </h3>
              <p className="text-sm text-muted">
                GDPR-compliant DPA
              </p>
            </Link>

            <Link href="/privacy" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Privacy Policy →
              </h3>
              <p className="text-sm text-muted">
                How we handle your data
              </p>
            </Link>

            <Link href="/terms" className="card bg-white p-6 shadow-soft hover:shadow-lg transition-all group">
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary">
                Terms of Service →
              </h3>
              <p className="text-sm text-muted">
                Service terms and conditions
              </p>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
