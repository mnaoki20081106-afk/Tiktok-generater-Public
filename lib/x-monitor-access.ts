import { cache } from 'react';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { isXMonitorEmailAllowlisted } from '@/lib/x-monitor-access-store';
import {
  hasActiveXMonitorSubscription,
  isXMonitorBillingConfigured,
} from '@/lib/x-monitor-billing';

export type XMonitorAccessSource =
  | 'admin'
  | 'manual'
  | 'subscription'
  | 'none'
  | 'signed_out';

export type XMonitorAccess = {
  authenticated: boolean;
  allowed: boolean;
  email: string | null;
  userId: string | null;
  source: XMonitorAccessSource;
  billingConfigured: boolean;
};

export async function resolveXMonitorAccess(input: {
  email: string | null | undefined;
  userId: string | null | undefined;
}): Promise<XMonitorAccess> {
  const email = input.email?.trim().toLowerCase() || null;
  const userId = input.userId || null;
  const billingConfigured = isXMonitorBillingConfigured();

  if (!email || !userId) {
    return {
      authenticated: false,
      allowed: false,
      email,
      userId,
      source: 'signed_out',
      billingConfigured,
    };
  }

  if (isAdminEmail(email)) {
    return {
      authenticated: true,
      allowed: true,
      email,
      userId,
      source: 'admin',
      billingConfigured,
    };
  }

  if (await isXMonitorEmailAllowlisted(email)) {
    return {
      authenticated: true,
      allowed: true,
      email,
      userId,
      source: 'manual',
      billingConfigured,
    };
  }

  if (billingConfigured) {
    try {
      if (await hasActiveXMonitorSubscription(email)) {
        return {
          authenticated: true,
          allowed: true,
          email,
          userId,
          source: 'subscription',
          billingConfigured,
        };
      }
    } catch (error) {
      console.error('[x-monitor-access] subscription lookup failed', error);
      // Billing lookup failures fail closed. A payment/API outage must never
      // accidentally expose the premium monitor.
    }
  }

  return {
    authenticated: true,
    allowed: false,
    email,
    userId,
    source: 'none',
    billingConfigured,
  };
}

export const getCurrentXMonitorAccess = cache(async (): Promise<XMonitorAccess> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return resolveXMonitorAccess({
    email: user?.email,
    userId: user?.id,
  });
});
