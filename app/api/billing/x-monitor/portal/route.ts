import { NextRequest, NextResponse } from 'next/server';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import { createXMonitorPortalSession } from '@/lib/x-monitor-billing';
import { resolvePublicSiteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await getCurrentXMonitorAccess();
  const origin = resolvePublicSiteOrigin(request.url);

  if (!access.authenticated || !access.email) {
    return NextResponse.redirect(new URL('/login', origin), 303);
  }

  if (access.source !== 'subscription') {
    return NextResponse.redirect(new URL('/x-monitor', origin), 303);
  }

  try {
    const portalUrl = await createXMonitorPortalSession({
      email: access.email,
      origin,
    });
    if (!portalUrl) {
      throw new Error('Stripe customer was not found');
    }
    return NextResponse.redirect(portalUrl, 303);
  } catch (error) {
    console.error('[x-monitor-billing] portal failed', error);
    return NextResponse.redirect(
      new URL('/x-monitor?billing=portal-error', origin),
      303,
    );
  }
}
