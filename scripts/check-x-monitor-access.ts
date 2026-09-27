import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isActiveXMonitorSubscriptionStatus } from '../lib/x-monitor-billing.ts';

assert.equal(isActiveXMonitorSubscriptionStatus('active'), true);
assert.equal(isActiveXMonitorSubscriptionStatus('trialing'), true);
assert.equal(isActiveXMonitorSubscriptionStatus('past_due'), false);
assert.equal(isActiveXMonitorSubscriptionStatus('unpaid'), false);
assert.equal(isActiveXMonitorSubscriptionStatus('canceled'), false);
assert.equal(isActiveXMonitorSubscriptionStatus(undefined), false);

const paywall = fs.readFileSync(
  new URL('../components/XMonitorPaywall.tsx', import.meta.url),
  'utf8',
);
const access = fs.readFileSync(
  new URL('../lib/x-monitor-access.ts', import.meta.url),
  'utf8',
);
const billing = fs.readFileSync(
  new URL('../lib/x-monitor-billing.ts', import.meta.url),
  'utf8',
);
const store = fs.readFileSync(
  new URL('../lib/x-monitor-access-store.ts', import.meta.url),
  'utf8',
);
const adminActions = fs.readFileSync(
  new URL('../app/admin/x-access-actions.ts', import.meta.url),
  'utf8',
);
const checkout = fs.readFileSync(
  new URL('../app/api/billing/x-monitor/checkout/route.ts', import.meta.url),
  'utf8',
);
const studioHeader = fs.readFileSync(
  new URL('../components/StudioHeader.tsx', import.meta.url),
  'utf8',
);
const dashboardLayout = fs.readFileSync(
  new URL('../app/dashboard/layout.tsx', import.meta.url),
  'utf8',
);

assert.match(paywall, /X監視はロックされています/);
assert.match(paywall, /月額サービスへのアップグレードが必要です/);
assert.match(paywall, /サイト作成機能はこれまで通り無料/);
assert.match(paywall, /LockKeyhole/);

assert.match(access, /isAdminEmail\(email\)/);
assert.match(access, /isXMonitorEmailAllowlisted\(email\)/);
assert.match(access, /hasActiveXMonitorSubscription\(email\)/);
assert.match(access, /allowlist lookup failed/);\nassert.match(access, /must not break the free dashboard/);\nassert.match(access, /fail closed/i);

assert.match(billing, /X_MONITOR_STRIPE_PRICE_ID/);
assert.match(billing, /mode', 'subscription'/);
assert.doesNotMatch(billing, /NEXT_PUBLIC_STRIPE_SECRET|NEXT_PUBLIC_X_MONITOR_STRIPE/);

assert.match(store, /public: false/);
assert.match(store, /app-private/);
assert.match(store, /x-monitor\/allowlist\.json/);

assert.match(adminActions, /assertAdmin\(\)/);
assert.match(adminActions, /addXMonitorAllowedEmail/);
assert.match(adminActions, /removeXMonitorAllowedEmail/);

assert.match(checkout, /getCurrentXMonitorAccess\(\)/);
assert.match(checkout, /if \(access\.allowed\)/);
assert.match(checkout, /createXMonitorCheckoutSession/);

assert.match(studioHeader, /studio-nav-locked/);
assert.match(studioHeader, /LockKeyhole/);
assert.match(dashboardLayout, /xMonitorLocked=\{!access\.allowed\}/);

console.log('✅ X monitor paid access checks passed');
