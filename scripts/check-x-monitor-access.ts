import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(path: string) {
  return fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

const paywall = read('components/XMonitorPaywall.tsx');
const access = read('lib/x-monitor-access.ts');
const billing = read('lib/x-monitor-billing.ts');
const payments = read('lib/x-monitor-payments.ts');
const store = read('lib/x-monitor-access-store.ts');
const adminActions = read('app/admin/x-access-actions.ts');
const paymentAdminActions = read('app/admin/x-payment-actions.ts');
const paymentAdminUi = read('app/admin/x-payment-settings.tsx');
const paymentForm = read('components/XMonitorPaymentForm.tsx');
const upgrade = read('app/x-monitor/upgrade/page.tsx');
const purchaseActions = read('app/x-monitor/upgrade/payment-actions.ts');
const checkout = read('app/api/billing/x-monitor/checkout/route.ts');
const portal = read('app/api/billing/x-monitor/portal/route.ts');
const monitorPage = read('app/x-monitor/page.tsx');
const studioHeader = read('components/StudioHeader.tsx');
const dashboardLayout = read('app/dashboard/layout.tsx');
const oidc = read('lib/github-actions-oidc.ts');
const privateSource = read('lib/x-monitor-private-source.ts');
const syncRoute = read('app/api/internal/x-monitor-sync/route.ts');
const migration = read('supabase/x-monitor-paypay-kyash.sql');
const envExample = read('.env.local.example');

assert.match(paywall, /X監視はロックされています/);
assert.match(paywall, /月額サービスへのアップグレードが必要です/);
assert.match(paywall, /サイト作成機能はこれまで通り無料/);
assert.match(paywall, /PayPay \/ Kyashで30日利用/);
assert.match(paywall, /LockKeyhole/);

assert.match(access, /isAdminEmail\(email\)/);
assert.match(access, /isXMonitorEmailAllowlisted\(email\)/);
assert.match(access, /getXMonitorSubscriptionExpiry\(userId\)/);
assert.match(access, /subscriptionExpiresAt/);
assert.match(access, /Existing paid access remains valid/);
assert.match(access, /allowlist lookup failed/);
assert.match(access, /must not break the free dashboard/);
assert.match(access, /fail closed/i);

assert.match(billing, /getActiveXMonitorSubscriptionExpiry/);
assert.match(billing, /isXMonitorPaymentConfigured/);
assert.doesNotMatch(billing, /api\.stripe\.com|STRIPE_SECRET_KEY|X_MONITOR_STRIPE_PRICE_ID/);
assert.doesNotMatch(upgrade, /Stripe/);
assert.doesNotMatch(envExample, /STRIPE_SECRET_KEY|X_MONITOR_STRIPE_PRICE_ID/);

assert.match(payments, /import 'server-only'/);
assert.match(payments, /aes-256-gcm/);
assert.match(payments, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(payments, /pay\.paypay\.ne\.jp/);
assert.match(payments, /kyash\.me/);
assert.match(payments, /getP2PLinkInfo/);
assert.match(payments, /acceptP2PSendMoneyLink/);
assert.match(payments, /api\.kyash\.me\/v2\/login/);
assert.match(payments, /\/v1\/links\//);
assert.match(payments, /PASSCODE_REQUIRED/);
assert.match(payments, /amount < payment\.amount/);
assert.match(payments, /createHash\('sha256'\)/);
assert.match(payments, /link_hash: linkHash/);
assert.match(payments, /x_monitor_finalize_payment/);
assert.match(payments, /getLatestPendingXMonitorPayment/);

assert.match(migration, /link_hash text not null unique/);
assert.match(migration, /payment_link_enc text/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.x_monitor_payments from anon, authenticated/);
assert.match(migration, /grant execute on function public\.x_monitor_finalize_payment\(uuid\) to service_role/);
assert.match(migration, /interval '30 days'/);
assert.match(migration, /greatest\(coalesce\(v_current_expiry, now\(\)\), now\(\)\)/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /if v_payment\.status = 'paid'/);

assert.match(store, /public: false/);
assert.match(store, /app-private/);
assert.match(store, /x-monitor\/allowlist\.json/);

assert.match(adminActions, /assertAdmin\(\)/);
assert.match(adminActions, /addXMonitorAllowedEmail/);
assert.match(adminActions, /removeXMonitorAllowedEmail/);
assert.match(paymentAdminActions, /assertAdmin\(\)/);
assert.match(paymentAdminActions, /startXMonitorPayPayLogin/);
assert.match(paymentAdminActions, /verifyXMonitorPayPayLogin/);
assert.match(paymentAdminActions, /startXMonitorKyashLogin/);
assert.match(paymentAdminActions, /verifyXMonitorKyashLogin/);
assert.match(paymentAdminActions, /disconnectXMonitorPaymentProvider/);
assert.match(paymentAdminUi, /PayPay受取アカウント/);
assert.match(paymentAdminUi, /Kyash受取アカウント/);
assert.match(paymentAdminUi, /料金・公開設定を保存/);

assert.match(upgrade, /XMonitorPaymentForm/);
assert.match(upgrade, /getXMonitorPaymentPublicConfig/);
assert.match(upgrade, /getLatestPendingXMonitorPayment/);
assert.match(upgrade, /現在の期限から30日追加/);
assert.match(paymentForm, /送金リンク/);
assert.match(paymentForm, /パスコードを設定せず/);
assert.match(paymentForm, /前回の決済を再確認/);
assert.match(purchaseActions, /createXMonitorPayment/);
assert.match(purchaseActions, /retryXMonitorPayment/);
assert.match(purchaseActions, /access\.source === 'admin'/);
assert.match(purchaseActions, /access\.source === 'manual'/);

assert.match(checkout, /\/x-monitor\/upgrade/);
assert.match(portal, /\/x-monitor\/upgrade/);
assert.doesNotMatch(checkout, /Stripe|createXMonitorCheckoutSession/);
assert.doesNotMatch(portal, /Stripe|createXMonitorPortalSession/);

assert.match(monitorPage, /access\.source === 'subscription'/);
assert.match(monitorPage, /subscriptionExpiresAt/);
assert.match(monitorPage, /30日延長/);
assert.doesNotMatch(monitorPage, /Stripe/);

assert.match(studioHeader, /studio-nav-locked/);
assert.match(studioHeader, /LockKeyhole/);
assert.match(dashboardLayout, /xMonitorLocked=\{!access\.allowed\}/);

assert.match(oidc, /RS256/);
assert.match(oidc, /webcrypto\.subtle\.verify/);
assert.match(oidc, /mnaoki20081106-afk\/X-Bunseki/);
assert.match(oidc, /refs\/heads\/main/);
assert.match(oidc, /\.github\/workflows\/monitor\.yml@refs\/heads\/main/);
assert.match(syncRoute, /verifyGitHubActionsOidcToken/);
assert.match(syncRoute, /assertXMonitorWorkflowClaims/);
assert.match(syncRoute, /savePrivateXMonitorSnapshot/);
assert.match(privateSource, /app-private/);
assert.match(privateSource, /public: false/);
assert.match(privateSource, /x-monitor\/latest\.json/);

console.log('✅ X monitor paid access + PayPay/Kyash billing checks passed');
