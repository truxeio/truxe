import Link from 'next/link';
import { login } from '@/lib/auth';

export default function HomePage() {
  return (
    <div>
      <h1>Truxe Next.js App Router Example</h1>
      <p>Welcome to the public homepage.</p>
      <form action={login}>
        <button type="submit">Login with Truxe</button>
      </form>
      <p><Link href="/dashboard">View Dashboard (protected)</Link></p>
    </div>
  );
}