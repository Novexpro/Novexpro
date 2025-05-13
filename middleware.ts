import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public paths that don't require authentication
const publicPaths = ['/', '/api/webhook'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  const isPublicPath = publicPaths.some(path => 
    path.endsWith('*') 
      ? pathname.startsWith(path.slice(0, -1))
      : pathname === path
  );

  // Allow access to public paths
  if (isPublicPath) {
    return NextResponse.next();
  }

  // For protected routes, handle auth through client-side redirects
  // This avoids using Clerk's server middleware which has Edge compatibility issues
  return NextResponse.next();
}

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
    // Include API routes
    '/api/:path*',
  ],
};