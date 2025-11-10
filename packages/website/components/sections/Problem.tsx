"use client";

import { PROBLEM_POINTS } from "@/lib/constants";

import { FadeIn } from "@/components/animations/FadeIn";
import { Card } from "@/components/ui/Card";

export function Problem() {
  return (
    <section id="problem" className="container-custom section-padding space-y-12">
      <div className="space-y-4 text-center md:text-left">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            The Gap
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            The Problem with Current Auth Solutions
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-lg text-muted md:max-w-3xl">
            Most auth solutions require trade-offs: convenience vs. control, simplicity vs. security,
            or speed vs. flexibility. Scaling teams need full control, transparent pricing,
            and security visibility without compromise.
          </p>
        </FadeIn>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {PROBLEM_POINTS.map((point, index) => (
          <FadeIn delay={0.1 * (index + 1)} key={point.vendor}>
            <Card className="group h-full space-y-4 bg-white/90 p-8 transition-all hover:scale-[1.02] hover:shadow-xl">
              <div className="inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary">
                <span className="text-2xl">
                  {index === 0 ? "☁️" : index === 1 ? "🎨" : "🏢"}
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {point.vendor}
              </h3>
              <p className="text-base leading-relaxed text-muted">
                {point.description}
              </p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.4}>
        <div className="mt-8 rounded-3xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-8 md:p-10">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-red-900">
                The Hidden Cost of Per-User Pricing
              </h3>
            </div>
            <p className="mb-6 text-lg text-red-800">
              Usage-based pricing starts affordable but scales exponentially. What begins at
              $23/month can balloon to <strong>$23,000/month</strong> as you grow—making
              success financially unsustainable.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white/80 p-4 text-center shadow-sm backdrop-blur">
                <div className="text-sm font-medium text-muted">1,000 users</div>
                <div className="mt-1 text-2xl font-bold text-orange-600">$240/mo</div>
              </div>
              <div className="rounded-xl bg-white/80 p-4 text-center shadow-sm backdrop-blur">
                <div className="text-sm font-medium text-muted">10,000 users</div>
                <div className="mt-1 text-2xl font-bold text-orange-700">$2,300/mo</div>
              </div>
              <div className="rounded-xl bg-white/90 p-4 text-center shadow-md backdrop-blur ring-2 ring-red-400">
                <div className="text-sm font-medium text-muted">100,000 users</div>
                <div className="mt-1 text-3xl font-bold text-red-600">$23,000/mo</div>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-red-700">
              Example pricing from a leading auth provider. Truxe offers predictable costs with{" "}
              <strong>unlimited users</strong>.
            </p>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
