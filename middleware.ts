import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple pass-through middleware with error handling
export function middleware(request: NextRequest) {
  try {
    // Just continue to the next middleware or route handler
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    // Return a basic response to prevent 500 errors
    return NextResponse.next();
  }
}

// Limit middleware execution to fewer routes to reduce potential issues
export const config = {
  matcher: [
    // Only run on API routes
    '/api/:path*'
  ],
};