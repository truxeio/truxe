"use client";

import { COMPARISON_TABLE } from "@/lib/constants";
import { motion } from "framer-motion";

import { FadeIn } from "@/components/animations/FadeIn";
import { Card } from "@/components/ui/Card";

export function Comparison() {
  const entries = Object.entries(COMPARISON_TABLE);

  return (
    <section
      id="comparison"
      className="container-custom section-padding space-y-12"
    >
      <div className="space-y-4 text-center md:text-left">
        <FadeIn>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Compared
          </p>
        </FadeIn>
        <FadeIn delay={0.1}>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            How Truxe stacks up
          </h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-lg text-muted md:max-w-3xl">
            Build on an auth platform that gives you control. No more black boxes
            or runaway pricing models.
          </p>
        </FadeIn>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {entries.map(([key, competitor], index) => (
          <FadeIn key={key} delay={0.1 * (index + 1)}>
            <Card className="h-full space-y-4 bg-white p-6">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  vs {competitor.label}
                </h3>
                <p className="mt-2 text-sm text-muted">{competitor.summary}</p>
              </div>
              <div className="space-y-3">
                {competitor.rows.map((row) => (
                  <div
                    key={row.feature}
                    className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-primary-light/20 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {row.feature}
                    </span>
                    <div className="text-right text-muted">
                      <p className="font-semibold text-primary">
                        {row.truxe}
                      </p>
                      <p className="text-xs text-muted">{row.competitor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </FadeIn>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <h3 className="text-2xl font-bold text-center text-foreground">
          Pricing Comparison: Predictable vs Per-User
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse overflow-hidden rounded-xl bg-white shadow-soft">
            <thead>
              <tr className="bg-primary/10">
                <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">
                  Scale
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                  Enterprise Tier
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                  UI-First Platform
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-primary">
                  Truxe Pro
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-success">
                  You Save
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-6 py-4 text-sm text-muted">1,000 users</td>
                <td className="px-6 py-4 text-right text-sm text-foreground">
                  $240/mo
                </td>
                <td className="px-6 py-4 text-right text-sm text-foreground">
                  $25/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-primary">
                  $79/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-success">
                  $161/mo
                </td>
              </tr>
              <tr className="border-t border-border bg-primary-light/5">
                <td className="px-6 py-4 text-sm text-muted">10,000 users</td>
                <td className="px-6 py-4 text-right text-sm text-foreground">
                  $2,300/mo
                </td>
                <td className="px-6 py-4 text-right text-sm text-foreground">
                  $250/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-primary">
                  $79/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-success">
                  $2,221/mo
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-6 py-4 text-sm text-muted">50,000 users</td>
                <td className="px-6 py-4 text-right text-sm text-foreground">
                  $11,500/mo
                </td>
                <td className="px-6 py-4 text-right text-sm text-foreground">
                  $1,250/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-primary">
                  $79/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-success">
                  $11,421/mo
                </td>
              </tr>
              <tr className="border-t border-border bg-success/5">
                <td className="px-6 py-4 text-sm font-semibold text-foreground">
                  100,000 users
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-red-600">
                  $23,000/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-semibold text-foreground">
                  $2,500/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-primary">
                  $79/mo
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-success">
                  $22,921/mo 🎉
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-center text-sm text-muted">
          * Pricing comparison based on typical enterprise and UI-first platform tiers.
          Truxe Professional: <strong>$79/month flat fee, unlimited users</strong>.
        </p>
      </motion.div>
    </section>
  );
}
