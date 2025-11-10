import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;
  const expiresAt = request.cookies.get('expires_at')?.value;

  if (!accessToken || !expiresAt) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (Date.now() >= parseInt(expiresAt) - 300000) {
    // Token expiring soon, redirect to refresh
    // In a real app, you'd have a refresh endpoint.
    // For this example, we'll just re-login for simplicity.
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete('access_token');
    response.cookies.delete('expires_at');
    response.cookies.delete('refresh_token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};