import { NextResponse, type NextRequest } from 'next/server';

const ACCESS = 'sp_at';
const REFRESH = 'sp_rt';

/** Decode JWT payload without verifying (routing UX only; the API enforces auth). */
function roleFrom(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const access = req.cookies.get(ACCESS)?.value;
  const refresh = req.cookies.get(REFRESH)?.value;
  const signedIn = !!(access || refresh);

  const isPrivate = pathname.startsWith('/app') || pathname.startsWith('/trade') || pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isPrivate && !signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // the standalone client-area home no longer exists as a destination: everything lives in the web terminal
  if (pathname === '/app' && signedIn) {
    const role = roleFrom(access);
    return NextResponse.redirect(new URL(role === 'admin' || role === 'superadmin' ? '/admin' : '/trade', req.url));
  }

  if (pathname.startsWith('/admin') && access) {
    const role = roleFrom(access);
    if (role && role !== 'admin' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/trade', req.url));
    }
  }

  if (isAuthPage && signedIn && access) {
    const role = roleFrom(access);
    return NextResponse.redirect(new URL(role === 'admin' || role === 'superadmin' ? '/admin' : '/trade', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/trade/:path*', '/admin/:path*', '/login', '/register'],
};
