import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Truxe + Next.js App Router',
  description: 'Example of using Truxe with Next.js App Router',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}