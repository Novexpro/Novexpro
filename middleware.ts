import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware doesn't use Clerk's server-side functions to avoid Edge compatibility issues
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

// Configure which paths this middleware will run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones we want to exclude
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
    // Include API routes that require authentication
    '/api/:path*',
  ],
};