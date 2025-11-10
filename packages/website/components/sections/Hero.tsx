"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import { SITE_CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function Hero() {
  const handleWaitlistClick = () => {
    document.querySelector("#waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="container-custom section-padding flex flex-col items-center justify-between gap-16 md:flex-row"
    >
      <motion.div
        className="flex-1 space-y-8 text-center md:text-left"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Badge className="mx-auto md:mx-0" variant="success">
          Open Core (MIT + BSL) · Self-hosted · Enterprise-ready
        </Badge>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Access that just works.
          </h1>
          <p className="text-lg text-muted md:text-xl">
            A clean identity layer—SSO, IAM, RBAC and policy in one place.
            Start free with Community Edition, scale to Professional when ready.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
          <Button size="lg" onClick={handleWaitlistClick}>
            Start Free
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => (window.location.href = "/docs")}
          >
            Read Docs
          </Button>
        </div>

        <div className="grid gap-2 text-sm text-muted md:flex md:items-center md:gap-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            No black boxes. Fully auditable.
          </span>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Built by developers, for developers.
          </span>
        </div>
      </motion.div>

      <motion.div
        className="flex-1"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
      >
        <div className="relative mx-auto max-w-xl rounded-3xl border border-primary-light/50 bg-white/70 p-6 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-3 text-sm text-slate-100">
            <span className="font-semibold text-primary-light">
              Login with Truxe
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
              OAuth 2.0
            </span>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950/95 p-6 text-sm text-slate-200">
            <code>
              {`import { truxe } from "@truxe/sdk"

// Sign in with Truxe
const authUrl = await truxe.oauth.authorize({
  clientId: "cl_abc123",
  redirectUri: "https://myapp.com/callback",
  scope: "openid email profile"
})

// Exchange code for tokens
const { accessToken, user } =
  await truxe.oauth.exchangeCode(code)`}
            </code>
          </pre>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-success/20 px-4 py-3 text-sm text-success">
            <span>OAuth Provider: Production Ready ✅</span>
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
