import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      <h1>Truxe Next.js Pages Router Example</h1>
      <p>Welcome to the public homepage.</p>
      <p><a href="/api/auth/login">Login with Truxe</a></p>
      <p><Link href="/dashboard">View Dashboard (protected)</Link></p>
    </div>
  );
}