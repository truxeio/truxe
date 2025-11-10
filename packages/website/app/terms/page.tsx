import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-white via-white to-primary-light/20">
        <div className="container-custom section-padding space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-primary md:text-5xl">
          Terms of Service
        </h1>
        <p className="text-lg text-muted">
          Understand how we work together
        </p>
      </div>

      <section className="space-y-6 text-base leading-7 text-muted">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Waitlist Terms</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Joining the waitlist does not guarantee beta or production access.</li>
            <li>
              Truxe is in active development and features may change prior to launch.
            </li>
            <li>
              We may contact you with onboarding resources, updates, and product news.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Usage Terms</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Do not misuse or abuse Truxe services or infrastructure.</li>
            <li>Do not use Truxe to violate laws or rights of others.</li>
            <li>We reserve the right to suspend access for abusive or malicious behavior.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Liability</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Truxe is provided “as-is” without warranties of any kind.</li>
            <li>
              Wundam LLC is not liable for indirect or consequential damages arising from
              the use of Truxe.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Governing Law</h2>
          <p className="mt-3">
            These terms are governed by the laws of the United States and any applicable
            local regulations for Wundam LLC.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="mt-3">
            Questions about these terms? Email us at{" "}
            <a
              href={`mailto:${SITE_CONFIG.contact.email}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_CONFIG.contact.email}
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
