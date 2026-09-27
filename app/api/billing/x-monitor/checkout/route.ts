import { NextRequest, NextResponse } from 'next/server';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import { createXMonitorCheckoutSession } from '@/lib/x-monitor-billing';
import { resolvePublicSiteOrigin } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const access = await getCurrentXMonitorAccess();
  const origin = resolvePublicSiteOrigin(request.url);

  if (!access.authenticated || !access.email || !access.userId) {
    return NextResponse.redirect(new URL('/login', origin), 303);
  }

  if (access.allowed) {
    return NextResponse.redirect(new URL('/x-monitor', origin), 303);
  }

  if (!access.billingConfigured) {
    return NextResponse.redirect(
      new URL('/x-monitor/upgrade?billing=unavailable', origin),
      303,
    );
  }

  try {
    const checkoutUrl = await createXMonitorCheckoutSession({
      email: access.email,
      userId: access.userId,
      origin,
    });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error('[x-monitor-billing] checkout failed', error);
    return NextResponse.redirect(
      new URL('/x-monitor/upgrade?billing=error', origin),
      303,
    );
  }
}
