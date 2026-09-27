import { Activity, BrainCircuit, Clock3, CreditCard, Radar } from 'lucide-react';
import { XMonitorFeedSwitcher } from '@/components/XMonitorFeedSwitcher';
import { XMonitorPaywall } from '@/components/XMonitorPaywall';
import { getCurrentXMonitorAccess } from '@/lib/x-monitor-access';
import { formatCompactNumber, getXMonitorData, xMonitorHealthMessage } from '@/lib/x-monitor';

export const dynamic = 'force-dynamic';

function updatedLabel(value: string | null) {
  if (!value) return '更新時刻不明';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(d);
}

export default async function XMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const access = await getCurrentXMonitorAccess();
  const query = await searchParams;

  if (!access.allowed) {
    return (
      <XMonitorPaywall
        authenticated={access.authenticated}
        billingConfigured={access.billingConfigured}
      />
    );
  }

  // Premium data is fetched only after the server-side entitlement check above.
  const data = await getXMonitorData();
  const healthMessage = xMonitorHealthMessage(data.status);

  return (
    <main className="xmon-wrap">
      <section className="xmon-hero">
        <div>
          <p className="studio-eyebrow">X VIRAL SIGNAL</p>
          <h1>X監視</h1>
        </div>
        <div className="xmon-hero-actions">
          <div className="xmon-live-card">
            <div className={`xmon-live-dot ${data.status.status === 'success' ? 'is-live' : ''}`} />
            <div>
              <span>MONITOR STATUS</span>
              <strong>{data.status.status === 'success' ? 'LIVE' : data.status.status.toUpperCase()}</strong>
              <small><Clock3 size={13} /> {updatedLabel(data.updatedAt)}</small>
            </div>
          </div>
          {access.source === 'subscription' && (
            <form action="/api/billing/x-monitor/portal" method="post">
              <button type="submit" className="xmon-manage-subscription">
                <CreditCard size={14} /> 契約を管理
              </button>
            </form>
          )}
        </div>
      </section>

      {query.billing === 'portal-error' && (
        <div className="xmon-alert" role="alert">
          契約管理画面を開けませんでした。Stripeのカスタマーポータル設定を確認してください。
        </div>
      )}

      {data.sourceError && (
        <div className="xmon-alert">
          監視データを取得できませんでした。既存Web機能には影響しません。
          <small>{data.sourceError}</small>
        </div>
      )}

      {!data.sourceError && healthMessage && (
        <div className="xmon-alert" role="status">{healthMessage}</div>
      )}

      <section className="xmon-summary" aria-label="監視サマリー">
        <div><Radar size={18} /><span>今回走査</span><strong>{formatCompactNumber(data.status.postsScanned)}</strong></div>
        <div><Activity size={18} /><span>追跡中</span><strong>{formatCompactNumber(data.status.watchlistActive)}</strong></div>
        <div><BrainCircuit size={18} /><span>モデル</span><strong>{data.model.champion.toUpperCase()}</strong></div>
        <div><span className="xmon-mini-label">24H教師</span><span>完了投稿</span><strong>{formatCompactNumber(data.model.completed24hPosts)}</strong></div>
      </section>

      <XMonitorFeedSwitcher
        earlyPosts={data.earlyPosts}
        trendingPosts={data.trendingPosts}
      />
    </main>
  );
}
