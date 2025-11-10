import { withAuth } from '@/lib/with-auth';
import { GetServerSidePropsContext } from 'next';
import Link from 'next/link';

// This is a sample GetServerSideProps function.
// You can fetch data here that your page needs.
export const getServerSideProps = withAuth(async (context: GetServerSidePropsContext) => {
    const accessToken = context.req.cookies.access_token;

    // You can now use the accessToken to fetch data from a protected API
    // For example:
    // const res = await fetch('https://api.example.com/me', {
    //   headers: { 'Authorization': `Bearer ${accessToken}` }
    // });
    // const user = await res.json();

    // For this example, we'll just pass a mock user.
    const user = { name: 'John Doe', email: 'john.doe@example.com' };

    return {
        props: {
            user,
        },
    };
});

interface DashboardProps {
    user: {
        name: string;
        email: string;
    };
}

export default function DashboardPage({ user }: DashboardProps) {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}!</p>
      <p>This is a protected page rendered on the server.</p>
      <p><a href="/api/auth/logout">Logout</a></p>
    </div>
  );
}