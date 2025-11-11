import Link from "next/link";
import Image from "next/image";

import { SITE_CONFIG } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t bg-white/80">
      <div className="container-custom section-padding space-y-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative h-10 w-10 flex items-center justify-center flex-shrink-0">
                <Image
                  src="/truxe-shield.svg"
                  alt="Truxe Shield"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {SITE_CONFIG.name}
              </h3>
            </div>
            <p className="text-sm text-muted">
              {SITE_CONFIG.tagline} Powered by{" "}
              <Link
                href={SITE_CONFIG.links.wundam}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Wundam LLC
              </Link>
              .
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link className="hover:text-primary" href={SITE_CONFIG.links.privacy}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary" href={SITE_CONFIG.links.terms}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary" href="/trust/dpa">
                  Data Processing Agreement
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary" href="/trust/subprocessors">
                  Subprocessors
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Trust & Security
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link className="hover:text-primary" href="/trust">
                  Trust Center
                </Link>
              </li>
              <li>
                <a
                  className="hover:text-primary"
                  href="https://status.truxe.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  System Status
                </a>
              </li>
              <li>
                <Link className="hover:text-primary" href={SITE_CONFIG.links.support}>
                  Support
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Contact
            </h4>
            <p className="text-sm text-muted">
              Email us at{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={`mailto:${SITE_CONFIG.contact.email}`}
              >
                {SITE_CONFIG.contact.email}
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-8">
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">
              © 2025{" "}
              <a
                href="https://wundam.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:text-primary"
              >
                Wundam LLC
              </a>
              . All rights reserved.
            </p>
            <p className="text-xs text-muted">
              &quot;Truxe&quot; and the Truxe logo are trademarks of Wundam LLC.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
              <span className="text-muted">Open Core Licensing:</span>
              <a
                href="https://github.com/truxeio/truxe/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MIT License
              </a>
              <span className="text-muted">·</span>
              <a
                href="https://github.com/truxeio/truxe/blob/main/LICENSE-BSL"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                BSL 1.1
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
