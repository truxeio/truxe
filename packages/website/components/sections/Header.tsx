"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

import { Menu, X } from "lucide-react";

import { SITE_CONFIG, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavClick = (href: string, external?: boolean) => {
    // If it's an external link, open in new tab
    if (external || href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
      setIsOpen(false);
      return;
    }

    // If it's a route path (starts with /), navigate using Next.js router
    if (href.startsWith("/")) {
      window.location.href = href;
      setIsOpen(false);
      return;
    }

    // If it's a hash link, scroll to the element
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <div className="container-custom flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
          <div className="relative h-12 w-12 flex items-center justify-center flex-shrink-0">
            <Image
              src="/truxe-shield.svg"
              alt="Truxe Shield"
              width={48}
              height={48}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span>{SITE_CONFIG.name}</span>
            <span className="text-sm font-normal text-muted">
              {SITE_CONFIG.tagline}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              onClick={() => handleNavClick(item.href, (item as any).external)}
              className="transition hover:text-foreground"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button onClick={() => handleNavClick("#waitlist")} size="sm">
            {SITE_CONFIG.waitlistCta}
          </Button>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground md:hidden"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle navigation"
          type="button"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <MobileMenu isOpen={isOpen} onNavigate={handleNavClick} />
    </header>
  );
}

interface MobileMenuProps {
  isOpen: boolean;
  onNavigate: (href: string) => void;
}

function MobileMenu({ isOpen, onNavigate }: MobileMenuProps) {
  return (
    <div
      className={cn(
        "md:hidden",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="container-custom space-y-4 pb-6">
        <div className="grid gap-3 text-base">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 text-left font-medium text-foreground shadow-sm transition hover:border-primary hover:text-primary"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <Button
          className="w-full"
          size="md"
          onClick={() => onNavigate("#waitlist")}
        >
          {SITE_CONFIG.waitlistCta}
        </Button>
      </div>
    </div>
  );
}
