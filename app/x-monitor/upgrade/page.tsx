import Link from 'next/link';
import { ArrowLeft, Check, CreditCard, LockKeyhole } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';

export const dynamic = 'force-dynamic';

export default async function XMonitorUpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const access = await getCurrentXMonitorAccess();
  const params = await searchParams;

  if (!access.authenticated) redirect('/login');
  if (access.allowed) redirect('/x-monitor');

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
            <h1>月額サービスへアップグレード</h1>
          </div>
        </div>

        <p className="xmon-lock-lead">
          サイト作成は無料のままです。月額契約の対象はX監視機能のみです。
          金額はStripeの決済画面で最終確認してから確定します。
        </p>

        <div className="xmon-upgrade-features">
          <span><Check size={15} /> 早期発見ランキング</span>
          <span><Check size={15} /> バズ進行中の投稿一覧</span>
          <span><Check size={15} /> 予測インプレッション・速度・加速度</span>
        </div>

        {params.billing === 'cancelled' && (
          <div className="xmon-billing-pending">決済はキャンセルされました。料金は発生していません。</div>
        )}

        {access.billingConfigured ? (
          <form action="/api/billing/x-monitor/checkout" method="post">
            <button type="submit" className="xmon-upgrade-button">
              <CreditCard size={16} /> Stripeで月額契約へ進む
            </button>
          </form>
        ) : (
          <div className="xmon-billing-pending" role="status">
            現在は決済設定が未完了です。Stripeの料金設定が入るまで契約処理は開始されません。
          </div>
        )}

        <p className="xmon-lock-note">
          契約状態は画面側ではなくサーバー側で確認し、有効な契約だけX監視を表示します。
        </p>
      </section>
    </main>
  );
}
