import { NextRequest, NextResponse } from 'next/server';
import { userAgent } from 'next/server';

export function middleware(request: NextRequest) {
  const { device } = userAgent(request);

  // Query param overrides for development/testing
  const forceDesktop = request.nextUrl.searchParams.get('desktop') === 'true';
  const forceMobile = request.nextUrl.searchParams.get('mobile') === 'true';

  let deviceType: 'mobile' | 'desktop';

  if (forceDesktop) {
    deviceType = 'desktop';
  } else if (forceMobile) {
    deviceType = 'mobile';
  } else {
    deviceType = device.type === 'mobile' || device.type === 'tablet' ? 'mobile' : 'desktop';
  }

  const response = NextResponse.next();
  response.headers.set('x-device-type', deviceType);

  // Cookie allows client components to read device type without layout shift
  response.cookies.set('device-type', deviceType, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60, // 1 hour — re-evaluated on next request
  });

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|admin|favicon.ico).*)'],
};
