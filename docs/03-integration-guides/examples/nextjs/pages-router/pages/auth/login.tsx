import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/api/auth/login');
  }, [router]);

  return <div>Redirecting to login...</div>;
}