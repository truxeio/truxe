"use client";

import { ARCHITECTURE_POINTS } from "@/lib/constants";

import { FadeIn } from "@/components/animations/FadeIn";
import { Card } from "@/components/ui/Card";

export function Architecture() {
  return (
    <section
      id="architecture"
      className="container-custom section-padding space-y-12"
    >
      <div className="space-y-4 text-center md:text-left">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Under the hood
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Built with modern architecture you can trust
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-lg text-muted md:max-w-3xl">
            Truxe is engineered for teams that need reliability, observability,
            and the flexibility to deploy on their own infrastructure.
          </p>
        </FadeIn>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {ARCHITECTURE_POINTS.map((point, index) => (
          <FadeIn delay={0.05 * index} key={point.title}>
            <Card className="h-full space-y-3 bg-white p-6">
              <h3 className="text-xl font-semibold text-foreground">
                {point.title}
              </h3>
              <p className="text-base text-muted">{point.description}</p>
            </Card>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
