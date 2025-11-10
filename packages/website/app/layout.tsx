import type { Metadata } from "next";
import Script from "next/script";
import { DM_Sans, Fira_Code } from "next/font/google";

import { SITE_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

import "../styles/globals.css";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  keywords: [
    "authentication",
    "authorization",
    "RBAC",
    "OAuth",
    "MFA",
    "open-source",
  ],
  authors: [{ name: "Wundam LLC", url: SITE_CONFIG.links.wundam }],
  creator: "Wundam LLC",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_CONFIG.url,
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: SITE_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: SITE_CONFIG.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: [SITE_CONFIG.ogImage],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={cn(
          "min-h-screen bg-background text-foreground antialiased",
          dmSans.variable,
          firaCode.variable,
        )}
      >
        {plausibleDomain ? (
          <Script
            strategy="lazyOnload"
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
