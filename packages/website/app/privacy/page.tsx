import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "January 2025";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-white via-white to-primary-light/20">
        <div className="container-custom section-padding space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-primary md:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-lg text-muted">
          Your privacy matters to us
        </p>
        <p className="text-sm text-muted">Last updated: {LAST_UPDATED}</p>
      </div>

      <section className="space-y-6 text-base leading-7 text-muted">
        <p>
          This Privacy Policy explains how Truxe collects, uses, and protects
          information when you interact with our website and waitlist.
        </p>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Data We Collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Email addresses provided via the waitlist form.</li>
            <li>Optional company or project details that you choose to share.</li>
            <li>Usage analytics via Plausible (cookie-free, aggregated insights).</li>
            <li>No tracking cookies or personal identifiers are stored.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">How We Use Data</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>To communicate early access information and product updates.</li>
            <li>To send onboarding resources and documentation when available.</li>
            <li>To notify you about security updates and release notes.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Data Storage</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Waitlist and email data is stored securely through Brevo (EU-based).</li>
            <li>Plausible analytics data is processed and stored in the EU.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Your Rights</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Request a copy of the data we store about you.</li>
            <li>Ask us to update or delete your information at any time.</li>
            <li>Opt-out of waitlist emails via unsubscribe links or direct request.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="mt-3">
            For privacy-related requests, email us at{" "}
            <a
              href={`mailto:${SITE_CONFIG.contact.privacy}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_CONFIG.contact.privacy}
            </a>
            .
          </p>
        </div>
      </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
