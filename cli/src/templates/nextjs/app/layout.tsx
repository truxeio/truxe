import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../components/auth/AuthProvider';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Heimdall Next.js App',
  description: 'Next.js application with Heimdall authentication - secure, passwordless login',
  keywords: 'authentication, passwordless, magic link, secure login, Next.js',
  authors: [{ name: 'Heimdall Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#3b82f6',
  openGraph: {
    title: 'Heimdall Next.js App',
    description: 'Secure authentication with magic links',
    type: 'website',
    siteName: 'Heimdall App',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Heimdall Next.js App',
    description: 'Secure authentication with magic links',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${inter.className} h-full antialiased`}>
        <ErrorBoundary>
          <AuthProvider
            apiUrl={process.env.NEXT_PUBLIC_HEIMDALL_URL || 'http://localhost:3001'}
            redirectTo="/dashboard"
            loginPath="/auth/login"
          >
            <div className="min-h-full">
              {children}
            </div>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
