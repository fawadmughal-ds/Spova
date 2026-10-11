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

/** The client area is a single page (/client-area). Old /app/* deep links open the matching panel there. */
const PANEL_FOR: Record<string, string> = {
  documents: 'documents',
  payments: 'payments',
  accounts: 'accounts',
  profile: 'profile',
  help: 'help',
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const access = req.cookies.get(ACCESS)?.value;
  const refresh = req.cookies.get(REFRESH)?.value;
  const signedIn = !!(access || refresh);

  const isPrivate = pathname.startsWith('/app') || pathname.startsWith('/client-area') || pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isPrivate && !signedIn) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // /app no longer exists: everything lives in the client-area terminal. Map old links to the right panel.
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    const url = req.nextUrl.clone();
    url.pathname = '/client-area';
    const seg = pathname.split('/')[2]; // /app/<seg>
    const panel = seg ? PANEL_FOR[seg] : undefined;
    if (panel) url.searchParams.set('panel', panel);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/admin') && access) {
    const role = roleFrom(access);
    if (role && role !== 'admin' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/client-area', req.url));
    }
  }

  if (isAuthPage && signedIn && access) {
    const role = roleFrom(access);
    return NextResponse.redirect(new URL(role === 'admin' || role === 'superadmin' ? '/admin' : '/client-area', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/client-area/:path*', '/admin/:path*', '/login', '/register'],
};
