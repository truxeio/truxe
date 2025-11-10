import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

export function DashboardPage() {
  const { logout, getAccessToken } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const accessToken = getAccessToken();
      if (accessToken) {
        try {
          // In a real app, you'd fetch from your API
          // const response = await fetch('https://api.example.com/me', {
          //   headers: { 'Authorization': `Bearer ${accessToken}` }
          // });
          // if (!response.ok) throw new Error('Failed to fetch user');
          // const data = await response.json();
          
          // Mocking user data for the example
          const data = { name: 'John Doe', email: 'john.doe@example.com' };
          setUser(data);
        } catch (err) {
          setError('Failed to fetch user data.');
        }
      }
    };

    fetchUser();
  }, [getAccessToken]);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome! This is a protected page.</p>
      {user && <pre>{JSON.stringify(user, null, 2)}</pre>}
      {error && <p style={{color: 'red'}}>{error}</p>}
      <button onClick={logout}>Logout</button>
    </div>
  );
}