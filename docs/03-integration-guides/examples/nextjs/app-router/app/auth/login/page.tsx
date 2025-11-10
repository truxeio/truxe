import { login } from '@/lib/auth';

export default function LoginPage() {
  return (
    <div>
      <h2>Session Expired or Invalid</h2>
      <p>Please log in again to continue.</p>
      <form action={login}>
        <button type="submit">Login with Heimdall</button>
      </form>
    </div>
  );
}