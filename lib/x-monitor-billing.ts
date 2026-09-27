type StripeList<T> = {
  data?: T[];
};

type StripeCustomer = {
  id: string;
  email?: string | null;
  metadata?: Record<string, string>;
};

type StripeSubscription = {
  id: string;
  status?: string | null;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  status?: string | null;
  mode?: string | null;
  metadata?: Record<string, string>;
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
  init?: {
    method?: 'GET' | 'POST';
    body?: URLSearchParams;
    idempotencyKey?: string;
  },
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
      ...(init?.idempotencyKey
        ? { 'Idempotency-Key': init.idempotencyKey }
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

async function getOrCreateXMonitorCustomer(input: {
  email: string;
  userId: string;
}): Promise<StripeCustomer> {
  const customers = await findStripeCustomersByEmail(input.email);
  const exact = customers.find(
    (customer) => customer.metadata?.supabase_user_id === input.userId,
  );
  if (exact) return exact;
  if (customers[0]) return customers[0];

  const body = new URLSearchParams();
  body.set('email', input.email);
  body.set('metadata[supabase_user_id]', input.userId);
  body.set('metadata[product]', 'x-monitor');

  return stripeRequest<StripeCustomer>('customers', {
    method: 'POST',
    body,
    idempotencyKey: `x-monitor-customer-${input.userId}`,
  });
}

async function findReusableXMonitorCheckout(
  customerId: string,
  userId: string,
): Promise<StripeCheckoutSession | null> {
  const params = new URLSearchParams({
    customer: customerId,
    status: 'open',
    limit: '20',
  });
  const result = await stripeRequest<StripeList<StripeCheckoutSession>>(
    `checkout/sessions?${params.toString()}`,
  );

  return (result.data || []).find((session) =>
    session.mode === 'subscription' &&
    session.metadata?.product === 'x-monitor' &&
    session.metadata?.supabase_user_id === userId &&
    Boolean(session.url)
  ) || null;
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

  const customer = await getOrCreateXMonitorCustomer(input);
  const reusable = await findReusableXMonitorCheckout(customer.id, input.userId);
  if (reusable?.url) return reusable.url;

  // Use a deterministic 30-minute bucket so simultaneous/repeated POSTs create
  // at most one Checkout Session for the same user/environment. The Checkout
  // itself stays open for at least 30 minutes and at most 60 minutes.
  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(nowSeconds / 1800) * 1800;
  const expiresAt = bucketStart + 3600;
  const host = new URL(input.origin).host.replace(/[^a-zA-Z0-9.-]/g, '_');

  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('success_url', `${input.origin}/x-monitor?billing=success`);
  body.set('cancel_url', `${input.origin}/x-monitor/upgrade?billing=cancelled`);
  body.set('customer', customer.id);
  body.set('client_reference_id', input.userId);
  body.set('line_items[0][price]', xMonitorPriceId());
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[supabase_user_id]', input.userId);
  body.set('metadata[product]', 'x-monitor');
  body.set('subscription_data[metadata][supabase_user_id]', input.userId);
  body.set('subscription_data[metadata][product]', 'x-monitor');
  body.set('expires_at', String(expiresAt));
  body.set('locale', 'ja');

  const session = await stripeRequest<StripeCheckoutSession>('checkout/sessions', {
    method: 'POST',
    body,
    idempotencyKey: `x-monitor-checkout-${input.userId}-${host}-${bucketStart}`,
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
