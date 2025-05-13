import { clerkMiddleware } from '@clerk/nextjs/server';

// Configure Clerk middleware
export default clerkMiddleware();

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