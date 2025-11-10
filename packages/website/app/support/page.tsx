import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata = {
  title: "Support",
};

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-white via-white to-primary-light/20">
        <div className="container-custom section-padding space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-primary md:text-5xl">
          Support
        </h1>
        <p className="text-lg text-muted">
          How can we help?
        </p>
      </div>

      <section className="space-y-6 text-base leading-7 text-muted">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Get Help</h2>
          <p className="mt-3">
            Email our team at{" "}
            <a
              href={`mailto:${SITE_CONFIG.contact.email}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_CONFIG.contact.email}
            </a>{" "}
            and we&apos;ll respond within 48 hours on weekdays.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Documentation</h2>
          <p className="mt-3">
            A comprehensive documentation hub is coming soon. Join the waitlist to receive
            early access to guides and integration walkthroughs.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Report a Bug</h2>
          <p className="mt-3">
            When reporting an issue, please include a clear description, reproduction
            steps, and expected vs actual behavior so we can resolve it quickly.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Request a Feature</h2>
          <p className="mt-3">
            Truxe is shaped by developers like you. Send us your ideas and we&apos;ll
            keep you posted on roadmap decisions.
          </p>
        </div>
      </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
