import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { canAccessHiddenRoutes, isHiddenRoutePath } from './config/features';

export function middleware(request: NextRequest) {
  const {
    nextUrl: { pathname, searchParams }
  } = request;

  if (!isHiddenRoutePath(pathname) || canAccessHiddenRoutes(searchParams)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/';
  redirectUrl.search = '';

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
