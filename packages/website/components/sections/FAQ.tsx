"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What's the difference between MIT and BSL licenses?",
    answer:
      "MIT License (Community Edition) is fully open source - you can do anything with it. BSL License (Professional/Enterprise) requires a paid license ($79-$499/month) for production use. Development and testing are FREE. After 4 years, all BSL code automatically converts to MIT (fully open source).",
  },
  {
    question: "Is there a user limit on the paid plans?",
    answer:
      "No! All paid plans have unlimited users. You pay a flat monthly fee ($79/month Professional, $499/month Enterprise) regardless of whether you have 100 users or 1 million users. No surprise bills as you scale.",
  },
  {
    question: "How does self-hosting work?",
    answer:
      "Truxe is designed to be self-hosted on your own infrastructure. You get Docker images and deployment guides for AWS, DigitalOcean, bare metal servers, or Kubernetes. Typical infrastructure costs are $50-100/month for a production setup.",
  },
  {
    question: "What happens after the BSL converts to MIT?",
    answer:
      "After 4 years from the first production release, all BSL-licensed code automatically becomes MIT licensed (fully open source). This means Professional and Enterprise features will eventually be free for everyone. We believe 4 years is enough time to establish market leadership through superior product and support.",
  },
  {
    question: "Can I migrate from other auth providers?",
    answer:
      "Yes! We provide migration guides and tools to help you move from other auth providers. Most migrations can be completed in a few hours with zero downtime using our dual-write strategy.",
  },
  {
    question: "What support do I get?",
    answer:
      "Community Edition: Community support via GitHub and Discord. Professional ($79/month): Email support with 48-hour response time. Enterprise ($499/month): Priority support (24/7) with 4-hour response time, dedicated account manager, and custom SLA.",
  },
  {
    question: "What unique features does Truxe offer?",
    answer:
      "Truxe includes several unique features: OAuth Provider ('Login with Truxe') - let other apps authenticate with your identity system. GitHub Integration (7 endpoints) - auto-create repos, sync permissions, trigger Actions on auth events. No other auth provider offers these developer-focused features out of the box.",
  },
  {
    question: "How much can I save compared to per-user pricing?",
    answer:
      "Most managed auth services charge per monthly active user (MAU). At 100K users, typical providers charge $2K-$23K/month. Truxe Professional is $79/month flat - no matter how many users you have. That's up to $22,921/month in savings at scale.",
  },
] as const;

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="container-custom section-padding space-y-12">
      <div className="space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Questions?
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Frequently Asked Questions
          </h2>
        </motion.div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        {FAQS.map((faq, index) => (
          <motion.div
            key={faq.question}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.05 }}
          >
            <div className="card overflow-hidden bg-white shadow-soft">
              <button
                onClick={() => toggleFAQ(index)}
                className="flex w-full items-center justify-between p-6 text-left transition hover:bg-primary-light/5"
                type="button"
              >
                <span className="pr-4 font-semibold text-foreground">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-primary transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-border px-6 pb-6 pt-4"
                >
                  <p className="text-muted">{faq.answer}</p>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
