import { NextRequest, NextResponse } from 'next/server';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import { resolvePublicSiteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

/**
 * Kept so old billing links do not 404 after the payment migration.
 * Payment renewal is handled on the X-monitor upgrade page.
 */
export async function POST(request: NextRequest) {
  const access = await getCurrentXMonitorAccess();
  const origin = resolvePublicSiteOrigin(request.url);

  if (!access.authenticated) {
    return NextResponse.redirect(new URL('/login', origin), 303);
  }
  return NextResponse.redirect(new URL('/x-monitor/upgrade', origin), 303);
}
