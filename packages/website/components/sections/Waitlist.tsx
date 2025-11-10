"use client";

import { FormEvent, useState } from "react";

import {
  SITE_CONFIG,
  WAITLIST_BENEFITS,
  WAITLIST_USE_CASES,
} from "@/lib/constants";

import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type FormState = {
  email: string;
  company: string;
  useCase: string;
};

type Status = "idle" | "loading" | "success" | "error";

const initialState: FormState = {
  email: "",
  company: "",
  useCase: WAITLIST_USE_CASES[0]?.value ?? "saas",
};

export function Waitlist() {
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.error ?? "Failed to join the waitlist.";
        throw new Error(message);
      }

      setStatus("success");
      setForm(initialState);

      if (typeof window !== "undefined") {
        window.plausible?.("Waitlist Signup", {
          props: { useCase: form.useCase },
        });
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  };

  return (
    <section
      id="waitlist"
      className="container-custom section-padding space-y-12"
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <FadeIn className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Be the first to know
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Join the Truxe early access waitlist
          </h2>
          <p className="text-lg text-muted">
            Truxe is in active development. Join the waitlist to receive beta
            invites, implementation guides, and early updates.
          </p>
          <ul className="space-y-3 text-base text-muted">
            {WAITLIST_BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">
                  ✓
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn delay={0.1}>
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-primary-light/60 bg-white/90 p-8 shadow-soft backdrop-blur"
          >
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-foreground"
              >
                Work email
              </label>
              <Input
                id="email"
                type="email"
                required
                placeholder="hey@yourcompany.com"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="company"
                className="text-sm font-semibold text-foreground"
              >
                Company / Project <span className="text-muted">(optional)</span>
              </label>
              <Input
                id="company"
                type="text"
                placeholder="Acme Labs"
                value={form.company}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, company: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="use-case"
                className="text-sm font-semibold text-foreground"
              >
                Primary use case
              </label>
              <select
                id="use-case"
                value={form.useCase}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, useCase: event.target.value }))
                }
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-base text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {WAITLIST_USE_CASES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Submitting…" : SITE_CONFIG.waitlistCta}
            </Button>

            {status === "success" && (
              <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
                You&apos;re in! Check your inbox for a confirmation email.
              </p>
            )}

            {status === "error" && errorMessage && (
              <p className="rounded-xl bg-error/10 px-4 py-3 text-sm font-medium text-error">
                {errorMessage}
              </p>
            )}
          </form>
        </FadeIn>
      </div>
    </section>
  );
}
