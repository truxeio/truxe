import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return (
    <div>
      <h1>Login Required</h1>
      <p>Please log in to continue.</p>
      <button onClick={login}>Login with Heimdall</button>
    </div>
  );
}