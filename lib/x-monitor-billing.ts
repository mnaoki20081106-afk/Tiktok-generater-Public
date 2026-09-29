import {
  getActiveXMonitorSubscriptionExpiry,
  getXMonitorPaymentPublicConfig,
  isXMonitorPaymentConfigured,
} from '@/lib/x-monitor-payments';

/**
 * Compatibility layer for the existing X-monitor access code.
 * Billing is no longer Stripe-based: a verified PayPay/Kyash payment grants
 * a 30-day entitlement.
 */
export async function isXMonitorBillingConfigured(): Promise<boolean> {
  return isXMonitorPaymentConfigured();
}

export async function hasActiveXMonitorSubscription(
  userId: string,
): Promise<boolean> {
  return Boolean(await getActiveXMonitorSubscriptionExpiry(userId));
}

export async function getXMonitorSubscriptionExpiry(
  userId: string,
): Promise<string | null> {
  return getActiveXMonitorSubscriptionExpiry(userId);
}

export { getXMonitorPaymentPublicConfig };
