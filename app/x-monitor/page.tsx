import Link from 'next/link';
import { Activity, BrainCircuit, CalendarClock, Clock3, Radar } from 'lucide-react';
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

function expiryLabel(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
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
  const subscriptionExpiry = expiryLabel(access.subscriptionExpiresAt);

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
            <>
              {subscriptionExpiry && (
                <div className="xmon-subscription-expiry">
                  <CalendarClock size={13} /> 利用期限 {subscriptionExpiry}
                </div>
              )}
              <Link href="/x-monitor/upgrade" className="xmon-manage-subscription">
                <CalendarClock size={14} /> 30日延長
              </Link>
            </>
          )}
        </div>
      </section>

      {query.billing === 'success' && (
        <div className="xmon-alert xmon-alert-success" role="status">
          支払いを反映しました。X監視の利用期限が30日延長されています。
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
