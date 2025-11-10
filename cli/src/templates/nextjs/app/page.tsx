import Link from 'next/link';
import { Button } from '@truxe/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-8">
            Welcome to your Truxe App
          </h1>
          
          <p className="text-xl mb-8 text-gray-600">
            Your Next.js application is ready with authentication powered by Truxe
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/auth/login">
              <Button variant="primary">
                Sign In
              </Button>
            </Link>
            
            <Link href="/dashboard">
              <Button variant="secondary">
                Dashboard
              </Button>
            </Link>
          </div>
          
          <div className="mt-12 text-left max-w-lg">
            <h2 className="text-2xl font-semibold mb-4">Features included:</h2>
            <ul className="space-y-2 text-gray-600">
              <li>✅ Magic link authentication</li>
              <li>✅ Protected routes</li>
              <li>✅ User session management</li>
              <li>✅ Automatic token refresh</li>
              <li>✅ TypeScript support</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
