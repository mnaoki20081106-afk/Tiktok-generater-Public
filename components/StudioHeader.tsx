import Link from 'next/link';
import { Layers } from 'lucide-react';

type StudioSection = 'x-monitor' | 'dashboard';

export function StudioHeader({ current }: { current?: StudioSection }) {
  return (
    <header className="studio-nav">
      <Link href="/dashboard" className="studio-brand" aria-label="ProfileHub ホーム">
        <span className="studio-mark">
          <Layers size={19} strokeWidth={1.6} />
        </span>
        ProfileHub
        <span className="studio-brand-label">STUDIO</span>
      </Link>

      <nav aria-label="メインナビゲーション">
        <Link
          href="/x-monitor"
          className={current === 'x-monitor' ? 'studio-nav-current' : undefined}
          aria-current={current === 'x-monitor' ? 'page' : undefined}
        >
          X監視
        </Link>
        <Link
          href="/dashboard"
          className={current === 'dashboard' ? 'studio-nav-current' : undefined}
          aria-current={current === 'dashboard' ? 'page' : undefined}
        >
          マイサイト
        </Link>
      </nav>
    </header>
  );
}
