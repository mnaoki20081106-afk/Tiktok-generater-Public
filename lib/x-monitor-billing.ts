type StripeList<T> = {
  data?: T[];
};

type StripeCustomer = {
  id: string;
  email?: string | null;
};

type StripeSubscription = {
  id: string;
  status?: string | null;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
};

type StripePortalSession = {
  url?: string | null;
};

function stripeSecret(): string {
  return (process.env.STRIPE_SECRET_KEY || '').trim();
}

export function xMonitorPriceId(): string {
  return (process.env.X_MONITOR_STRIPE_PRICE_ID || '').trim();
}

export function isXMonitorBillingConfigured(): boolean {
  return Boolean(stripeSecret() && xMonitorPriceId());
}

export function isActiveXMonitorSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

async function stripeRequest<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: URLSearchParams },
): Promise<T> {
  const secret = stripeSecret();
  if (!secret) {
    throw new Error('Stripe is not configured');
  }

  const response = await fetch(`https://api.stripe.com/v1/${path.replace(/^\//, '')}`, {
    method: init?.method || 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init?.body
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : {}),
    },
    body: init?.body?.toString(),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Stripe HTTP ${response.status}`);
  }

  return payload;
}

async function findStripeCustomersByEmail(email: string): Promise<StripeCustomer[]> {
  if (!stripeSecret()) return [];
  const params = new URLSearchParams({
    email,
    limit: '100',
  });
  const result = await stripeRequest<StripeList<StripeCustomer>>(
    `customers?${params.toString()}`,
  );
  return result.data || [];
}

export async function hasActiveXMonitorSubscription(email: string): Promise<boolean> {
  if (!isXMonitorBillingConfigured()) return false;

  const customers = await findStripeCustomersByEmail(email);
  if (!customers.length) return false;

  for (const customer of customers) {
    const params = new URLSearchParams({
      customer: customer.id,
      price: xMonitorPriceId(),
      status: 'all',
      limit: '100',
    });
    const result = await stripeRequest<StripeList<StripeSubscription>>(
      `subscriptions?${params.toString()}`,
    );
    if ((result.data || []).some((subscription) =>
      isActiveXMonitorSubscriptionStatus(subscription.status)
    )) {
      return true;
    }
  }

  return false;
}

export async function createXMonitorCheckoutSession(input: {
  email: string;
  userId: string;
  origin: string;
}): Promise<string> {
  if (!isXMonitorBillingConfigured()) {
    throw new Error('X monitoring billing is not configured');
  }

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', `${input.origin}/x-monitor?billing=success`);
  body.set('cancel_url', `${input.origin}/x-monitor/upgrade?billing=cancelled`);
  body.set('customer_email', input.email);
  body.set('client_reference_id', input.userId);
  body.set('line_items[0][price]', xMonitorPriceId());
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[supabase_user_id]', input.userId);
  body.set('metadata[product]', 'x-monitor');
  body.set('subscription_data[metadata][supabase_user_id]', input.userId);
  body.set('subscription_data[metadata][product]', 'x-monitor');
  body.set('locale', 'ja');

  const session = await stripeRequest<StripeCheckoutSession>('checkout/sessions', {
    method: 'POST',
    body,
  });

  if (!session.url) {
    throw new Error('Stripe checkout URL was not returned');
  }
  return session.url;
}

export async function createXMonitorPortalSession(input: {
  email: string;
  origin: string;
}): Promise<string | null> {
  if (!stripeSecret()) return null;

  const customers = await findStripeCustomersByEmail(input.email);
  const customer = customers[0];
  if (!customer) return null;

  const body = new URLSearchParams();
  body.set('customer', customer.id);
  body.set('return_url', `${input.origin}/x-monitor`);

  const session = await stripeRequest<StripePortalSession>('billing_portal/sessions', {
    method: 'POST',
    body,
  });
  return session.url || null;
}
