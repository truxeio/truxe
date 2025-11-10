import { cookies } from 'next/headers';
import Link from 'next/link';

async function getUser() {
    const accessToken = cookies().get('access_token')?.value;
    if (!accessToken) {
        return null;
    }
    // In a real app, you would fetch user data from your API
    // using the access token.
    // const res = await fetch('https://api.example.com/user', {
    //   headers: { Authorization: `Bearer ${accessToken}` }
    // });
    // if (!res.ok) return null;
    // return res.json();

    // For this example, we'll return a mock user.
    return { name: 'John Doe', email: 'john.doe@example.com' };
}


export default async function DashboardPage() {
    const user = await getUser();

    if (!user) {
        return (
            <div>
                <h1>Dashboard</h1>
                <p>You are not logged in.</p>
                <Link href="/">Go to Homepage</Link>
            </div>
        )
    }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}!</p>
      <p>This is a protected page.</p>
      <a href="/auth/logout">Logout</a>
    </div>
  );
}