import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import {
  RateLimiter,
  getRateLimitIdentifier,
  isRateLimitExempt,
  applyRateLimitHeaders,
  RATE_LIMIT_TIERS,
} from '@/lib/rate-limit';
import { apiError } from '@/lib/api-response';

// Create a global rate limiter instance
const globalRateLimiter = new RateLimiter({
  interval: 60000, // 1 minute
  algorithm: 'sliding-window',
});

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/auth/error',
    '/api/webauthn/register-options',
    '/api/webauthn/register-verify',
    '/api/webauthn/auth-options',
    '/api/webauthn/auth-verify',
  ];

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Allow public routes and static files
  if (isPublicRoute || pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Apply rate limiting before authentication check (for all routes including API)
  // Skip rate limiting for exempt routes
  if (!isRateLimitExempt(pathname)) {
    const { identifier, tier } = getRateLimitIdentifier(req, req.auth ?? undefined);
    const limit = RATE_LIMIT_TIERS[tier];

    try {
      const rateLimitResult = await globalRateLimiter.check(limit, identifier);

      if (!rateLimitResult.success) {
        // Rate limit exceeded
        const resetIso = new Date(rateLimitResult.reset).toISOString();
        const retryAfterSeconds = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);

        // For API routes, return JSON error
        if (pathname.startsWith('/api/')) {
          const response = apiError('RATE_LIMITED', 429, 'Rate limit exceeded', {
            limit: rateLimitResult.limit,
            reset: resetIso,
            retry_after: retryAfterSeconds,
          });
          return applyRateLimitHeaders(response, rateLimitResult);
        }

        // For non-API routes, redirect to an error page or show a custom page
        const response = new NextResponse(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
            reset: resetIso,
            retry_after: retryAfterSeconds,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        return applyRateLimitHeaders(response, rateLimitResult);
      }

      // Rate limit passed, add headers to response
      const response = NextResponse.next();
      applyRateLimitHeaders(response, rateLimitResult);

      // Continue with authentication check
      if (!isAuthenticated) {
        const url = new URL('/auth/signin', req.url);
        url.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(url);
      }

      return response;
    } catch (error) {
      // Log error but don't block the request if rate limiting fails
      console.error('Rate limiting error:', error);
    }
  }

  // Redirect unauthenticated users to signin (for non-rate-limited or exempt routes)
  if (!isAuthenticated) {
    const url = new URL('/auth/signin', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
