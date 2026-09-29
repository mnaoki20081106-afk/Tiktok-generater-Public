import Link from 'next/link';
import { ArrowLeft, Check, LockKeyhole } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import {
  getLatestPendingXMonitorPayment,
  getXMonitorPaymentPublicConfig,
} from '@/lib/x-monitor-payments';
import { XMonitorPaymentForm } from '@/components/XMonitorPaymentForm';

export const dynamic = 'force-dynamic';

function expiryLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

export default async function XMonitorUpgradePage() {
  const access = await getCurrentXMonitorAccess();

  if (!access.authenticated || !access.userId) redirect('/login');
  if (access.source === 'admin' || access.source === 'manual') {
    redirect('/x-monitor');
  }

  const [paymentConfig, pendingPayment] = await Promise.all([
    getXMonitorPaymentPublicConfig().catch(() => ({
      paypay: { available: false, price: 0 },
      kyash: { available: false, price: 0 },
    })),
    getLatestPendingXMonitorPayment(access.userId).catch(() => null),
  ]);
  const expiresLabel = expiryLabel(access.subscriptionExpiresAt);

  return (
    <main className="xmon-wrap xmon-upgrade-wrap">
      <Link href="/x-monitor" className="xmon-back">
        <ArrowLeft size={16} /> X監視へ戻る
      </Link>

      <section className="xmon-upgrade-card">
        <div className="xmon-upgrade-title">
          <div className="xmon-lock-icon" aria-hidden="true">
            <LockKeyhole size={30} />
          </div>
          <div>
            <p className="studio-eyebrow">X MONITOR PREMIUM</p>
            <h1>{access.source === 'subscription' ? 'X監視を30日延長' : 'X監視を30日利用'}</h1>
          </div>
        </div>

        <p className="xmon-lock-lead">
          サイト作成は無料のままです。X監視だけをPayPayまたはKyashで購入できます。
          1回の支払いで30日利用でき、期限が残っている状態で更新した場合は現在の期限から30日追加します。
        </p>

        {expiresLabel && (
          <div className="xmon-current-expiry">
            現在の利用期限 <strong>{expiresLabel}</strong>
          </div>
        )}

        <div className="xmon-upgrade-features">
          <span><Check size={15} /> 早期発見ランキング</span>
          <span><Check size={15} /> バズ進行中の投稿一覧</span>
          <span><Check size={15} /> 予測インプレッション・速度・加速度</span>
        </div>

        <XMonitorPaymentForm
          config={paymentConfig}
          pendingPayment={pendingPayment}
        />

        <p className="xmon-lock-note">
          支払いの判定と利用期限の更新はサーバー側で行います。同じ送金リンクを使って二重に延長することはできません。
        </p>
      </section>
    </main>
  );
}
