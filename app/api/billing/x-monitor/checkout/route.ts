import { NextRequest, NextResponse } from 'next/server';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import { resolvePublicSiteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/**
 * Compatibility endpoint for old billing checkout links.
 * PayPay/Kyash payments are now entered directly on /x-monitor/upgrade.
 */
export async function POST(request: NextRequest) {
  const access = await getCurrentXMonitorAccess();
  const origin = resolvePublicSiteOrigin(request.url);

  if (!access.authenticated) {
    return NextResponse.redirect(new URL('/login', origin), 303);
  }
  return NextResponse.redirect(new URL('/x-monitor/upgrade', origin), 303);
}
