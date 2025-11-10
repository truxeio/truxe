"use client";

import { USE_CASES } from "@/lib/constants";

import { FadeIn } from "@/components/animations/FadeIn";
import { Card } from "@/components/ui/Card";

export function UseCases() {
  return (
    <section
      id="use-cases"
      className="container-custom section-padding space-y-12"
    >
      <div className="space-y-4 text-center md:text-left">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Who it’s for
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Built for teams who need control and velocity
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-lg text-muted md:max-w-3xl">
            Whether you&apos;re scaling a SaaS product or protecting internal tools,
            Truxe gives you the guardrails and insight you need.
          </p>
        </FadeIn>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {USE_CASES.map((useCase, index) => (
          <FadeIn delay={0.05 * index} key={useCase.title}>
            <Card className="h-full space-y-3 bg-white/90 p-6">
              <h3 className="text-xl font-semibold text-foreground">
                {useCase.title}
              </h3>
              <p className="text-base text-muted">{useCase.description}</p>
            </Card>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
