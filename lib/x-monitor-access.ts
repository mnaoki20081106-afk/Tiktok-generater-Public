import { cache } from 'react';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { isXMonitorEmailAllowlisted } from '@/lib/x-monitor-access-store';
import {
  getXMonitorSubscriptionExpiry,
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
  subscriptionExpiresAt: string | null;
};

async function billingConfiguredSafely(): Promise<boolean> {
  try {
    return await isXMonitorBillingConfigured();
  } catch (error) {
    console.error('[x-monitor-access] billing config lookup failed', error);
    return false;
  }
}

export async function resolveXMonitorAccess(input: {
  email: string | null | undefined;
  userId: string | null | undefined;
}): Promise<XMonitorAccess> {
  const email = input.email?.trim().toLowerCase() || null;
  const userId = input.userId || null;
  const billingConfigured = await billingConfiguredSafely();

  if (!email || !userId) {
    return {
      authenticated: false,
      allowed: false,
      email,
      userId,
      source: 'signed_out',
      billingConfigured,
      subscriptionExpiresAt: null,
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
      subscriptionExpiresAt: null,
    };
  }

  try {
    if (await isXMonitorEmailAllowlisted(email)) {
      return {
        authenticated: true,
        allowed: true,
        email,
        userId,
        source: 'manual',
        billingConfigured,
        subscriptionExpiresAt: null,
      };
    }
  } catch (error) {
    console.error('[x-monitor-access] allowlist lookup failed', error);
    // Access-control storage failures must not break the free dashboard.
    // Continue as not manually allowlisted and keep the premium feature closed.
  }

  // Existing paid access remains valid even if new purchases are temporarily
  // disabled or both receiving accounts are disconnected.
  try {
    const subscriptionExpiresAt = await getXMonitorSubscriptionExpiry(userId);
    if (subscriptionExpiresAt) {
      return {
        authenticated: true,
        allowed: true,
        email,
        userId,
        source: 'subscription',
        billingConfigured,
        subscriptionExpiresAt,
      };
    }
  } catch (error) {
    console.error('[x-monitor-access] subscription lookup failed', error);
    // Billing lookup failures fail closed. A database/payment outage must never
    // accidentally expose the premium monitor.
  }

  return {
    authenticated: true,
    allowed: false,
    email,
    userId,
    source: 'none',
    billingConfigured,
    subscriptionExpiresAt: null,
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
