"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

const CODE_EXAMPLES = {
  javascript: `import { truxe } from "@truxe/sdk"

// 1. Connect your IdP or use Truxe as IdP
const authUrl = await truxe.oauth.authorize({
  clientId: "your_client_id",
  redirectUri: "https://yourapp.com/callback",
  scope: "openid email profile"
})

// 2. Define roles & fine-grained policies
await truxe.rbac.createRole({
  name: "admin",
  permissions: ["users:read", "users:write", "settings:*"]
})

// 3. Ship with our SDK in minutes
const { user, session } = await truxe.auth.verify(token)
console.log("Authenticated:", user.email)`,

  python: `from truxe import TruxeClient

# 1. Connect your IdP or use Truxe as IdP
client = TruxeClient(api_key="your_api_key")
auth_url = client.oauth.authorize(
    client_id="your_client_id",
    redirect_uri="https://yourapp.com/callback",
    scope="openid email profile"
)

# 2. Define roles & fine-grained policies
client.rbac.create_role(
    name="admin",
    permissions=["users:read", "users:write", "settings:*"]
)

# 3. Ship with our SDK in minutes
user, session = client.auth.verify(token)
print(f"Authenticated: {user.email}")`,

  go: `package main

import "github.com/wundam/truxe-go"

func main() {
    // 1. Connect your IdP or use Truxe as IdP
    client := truxe.NewClient("your_api_key")
    authURL, _ := client.OAuth.Authorize(truxe.AuthorizeParams{
        ClientID:    "your_client_id",
        RedirectURI: "https://yourapp.com/callback",
        Scope:       "openid email profile",
    })

    // 2. Define roles & fine-grained policies
    client.RBAC.CreateRole(truxe.Role{
        Name:        "admin",
        Permissions: []string{"users:read", "users:write", "settings:*"},
    })

    // 3. Ship with our SDK in minutes
    user, session, _ := client.Auth.Verify(token)
    fmt.Printf("Authenticated: %s\\n", user.Email)
}`,
} as const;

const STEPS = [
  {
    number: "01",
    title: "Connect your IdP",
    description:
      "Use Truxe as your identity provider or integrate with existing ones like Google, GitHub, or any OIDC-compliant service.",
  },
  {
    number: "02",
    title: "Define roles & policies",
    description:
      "Set up granular RBAC with resource-level permissions that scale with your organization's complexity.",
  },
  {
    number: "03",
    title: "Ship in minutes",
    description:
      "Integrate with our SDK in JavaScript, Python, or Go. Production-ready code with full TypeScript support.",
  },
] as const;

export function HowItWorks() {
  const [activeLanguage, setActiveLanguage] =
    useState<keyof typeof CODE_EXAMPLES>("javascript");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CODE_EXAMPLES[activeLanguage]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="how-it-works"
      className="container-custom section-padding space-y-12 bg-gradient-to-b from-white to-primary-light/10"
    >
      {/* Header */}
      <div className="space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            How It Works
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Three steps to production-ready auth
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <p className="text-lg text-muted md:mx-auto md:max-w-2xl">
            From zero to secure authentication in minutes, not days. No complex
            configuration, no hidden complexity.
          </p>
        </motion.div>
      </div>

      {/* Steps */}
      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="relative"
          >
            <div className="card h-full space-y-4 bg-white p-8 shadow-soft">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                  {step.number}
                </span>
                <h3 className="text-xl font-bold text-foreground">
                  {step.title}
                </h3>
              </div>
              <p className="text-base text-muted">{step.description}</p>
            </div>
            {index < STEPS.length - 1 && (
              <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 md:block">
                <svg
                  className="h-8 w-8 text-primary/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Code Example */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-foreground">
            See it in action
          </h3>
          <div className="flex gap-2">
            {(Object.keys(CODE_EXAMPLES) as Array<keyof typeof CODE_EXAMPLES>).map(
              (lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLanguage(lang)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    activeLanguage === lang
                      ? "bg-primary text-white"
                      : "bg-white text-muted hover:bg-primary-light/20"
                  }`}
                  type="button"
                >
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="relative rounded-2xl bg-slate-950 p-6">
          <button
            onClick={handleCopy}
            className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            type="button"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
          <pre className="overflow-x-auto pr-24 text-sm text-slate-200">
            <code>{CODE_EXAMPLES[activeLanguage]}</code>
          </pre>
        </div>

        <p className="text-center text-sm text-muted">
          Full documentation and more examples available in our{" "}
          <a
            href="/docs"
            className="font-semibold text-primary hover:underline"
          >
            Developer Guide
          </a>
        </p>
      </motion.div>
    </section>
  );
}
