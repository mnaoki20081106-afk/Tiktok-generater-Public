import { Activity, BrainCircuit, Clock3, Radar } from 'lucide-react';
import { XPostCard } from '@/components/XPostCard';
import { formatCompactNumber, getXMonitorData } from '@/lib/x-monitor';

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

export default async function XMonitorPage() {
  const data = await getXMonitorData();

  return (
    <main className="xmon-wrap">
      <section className="xmon-hero">
        <div>
          <p className="studio-eyebrow">X VIRAL SIGNAL</p>
          <h1>伸び切る前の投稿を、<span>予測最終imp</span>で見る。</h1>
          <p>
            X-Bunsekiの実測時系列と予測モデルを、最終インプレッション予測が
            大きい順に表示しています。
          </p>
        </div>
        <div className="xmon-live-card">
          <div className={`xmon-live-dot ${data.status.status === 'success' ? 'is-live' : ''}`} />
          <div>
            <span>MONITOR STATUS</span>
            <strong>{data.status.status === 'success' ? 'LIVE' : data.status.status.toUpperCase()}</strong>
            <small><Clock3 size={13} /> {updatedLabel(data.updatedAt)}</small>
          </div>
        </div>
      </section>

      {data.sourceError && (
        <div className="xmon-alert">
          監視データを取得できませんでした。既存Web機能には影響しません。
          <small>{data.sourceError}</small>
        </div>
      )}

      <section className="xmon-summary" aria-label="監視サマリー">
        <div><Radar size={18} /><span>今回走査</span><strong>{formatCompactNumber(data.status.postsScanned)}</strong></div>
        <div><Activity size={18} /><span>追跡中</span><strong>{formatCompactNumber(data.status.watchlistActive)}</strong></div>
        <div><BrainCircuit size={18} /><span>モデル</span><strong>{data.model.champion.toUpperCase()}</strong></div>
        <div><span className="xmon-mini-label">24H教師</span><span>完了投稿</span><strong>{formatCompactNumber(data.model.completed24hPosts)}</strong></div>
      </section>

      <section className="xmon-feed-head">
        <div>
          <p className="studio-eyebrow">PREDICTED FINAL RANKING</p>
          <h2>バズ候補</h2>
        </div>
        <span>{data.posts.length} posts · 予測値なしは後順位</span>
      </section>

      <div className="xmon-feed">
        {data.posts.length ? (
          data.posts.map((post, index) => (
            <XPostCard key={post.id} post={post} rank={index + 1} />
          ))
        ) : (
          <div className="xmon-empty">現在表示できる投稿がありません。</div>
        )}
      </div>
    </main>
  );
}
