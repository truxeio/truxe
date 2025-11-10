import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  cookies().delete('access_token');
  cookies().delete('refresh_token');
  cookies().delete('expires_at');
  redirect('/');
}