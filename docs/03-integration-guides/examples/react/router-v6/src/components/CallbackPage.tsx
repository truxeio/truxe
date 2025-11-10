import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // You should verify the state
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

    if (code && codeVerifier) {
      // The handleTokenExchange function is exposed on the window by AuthContext
      (window as any).handleTokenExchange(code, codeVerifier)
        .then(() => {
          sessionStorage.removeItem('oauth_code_verifier');
          navigate('/dashboard', { replace: true });
        });
    } else {
      // Handle error
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return <div>Processing login...</div>;
}