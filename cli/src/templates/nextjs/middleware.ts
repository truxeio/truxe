import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CSRF token validation
function validateCSRFToken(request: NextRequest): boolean {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    return true; // CSRF protection not needed for safe methods
  }

  const csrfToken = request.headers.get('x-csrf-token');
  const csrfCookie = request.cookies.get('csrf-token')?.value;
  
  return csrfToken === csrfCookie;
}

// Verify authentication token
async function verifyAuthToken(request: NextRequest): Promise<any> {
  try {
    const accessToken = request.cookies.get('heimdall_access_token')?.value;
    
    if (!accessToken) {
      return null;
    }

    // Verify token with Heimdall API
    const response = await fetch(
      `${process.env.TRUXE_URL || 'http://localhost:3001'}/auth/me`,
      {
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.user;
    }

    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  const publicPaths = [
    '/_next',
    '/api/public',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/verify',
    '/auth/callback',
  ];

  const isPublicRoute = publicRoutes.includes(pathname);

  // CSRF Protection for state-changing requests
  if (!isPublicRoute && !validateCSRFToken(request)) {
    return new NextResponse('CSRF token validation failed', { status: 403 });
  }

  // Protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/profile',
    '/organization',
    '/admin',
  ];

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    const user = await verifyAuthToken(request);
    
    if (!user) {
      // Redirect to login with return URL
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Add user info to headers for the page
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-email', user.email);
    
    if (user.org) {
      response.headers.set('x-user-org-id', user.org.id);
      response.headers.set('x-user-role', user.org.role);
    }

    return response;
  }

  // For authenticated users visiting public routes, optionally redirect to dashboard
  if (isPublicRoute && pathname === '/') {
    const user = await verifyAuthToken(request);
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Security headers for all responses
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // CSP header
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' " +
    (process.env.TRUXE_URL || 'http://localhost:3001')
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
