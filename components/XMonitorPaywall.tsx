import Link from 'next/link';
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';

export function XMonitorPaywall({
  authenticated,
  billingConfigured,
}: {
  authenticated: boolean;
  billingConfigured: boolean;
}) {
  return (
    <main className="xmon-wrap xmon-locked-wrap">
      <section className="xmon-lock-card" aria-labelledby="x-monitor-lock-title">
        <div className="xmon-lock-icon" aria-hidden="true">
          <LockKeyhole size={34} strokeWidth={1.7} />
        </div>
        <p className="studio-eyebrow">PREMIUM ACCESS</p>
        <h1 id="x-monitor-lock-title">X監視はロックされています</h1>
        <p className="xmon-lock-lead">
          X監視を利用するには、月額サービスへのアップグレードが必要です。
          サイト作成機能はこれまで通り無料で利用できます。
        </p>

        <div className="xmon-lock-points" aria-label="X監視の内容">
          <span><Sparkles size={15} /> 伸び始めた投稿の早期発見</span>
          <span><ShieldCheck size={15} /> 権限はサーバー側で確認</span>
        </div>

        {authenticated ? (
          <>
            <Link href="/x-monitor/upgrade" className="xmon-upgrade-button">
              月額サービスへアップグレード <ArrowRight size={16} />
            </Link>
            {!billingConfigured && (
              <div className="xmon-billing-pending" role="status">
                決済設定を準備中です。料金が確定するまで課金は行われません。
              </div>
            )}
          </>
        ) : (
          <Link href="/login" className="xmon-upgrade-button">
            ログインして利用状況を確認 <ArrowRight size={16} />
          </Link>
        )}

        <p className="xmon-lock-note">
          管理者または管理画面で個別に許可されたアカウントは、月額契約なしでも利用できます。
        </p>
      </section>
    </main>
  );
}
