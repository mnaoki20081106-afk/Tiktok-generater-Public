import Link from 'next/link';
import { ArrowUpRight, Layers } from 'lucide-react';

export function StudioHeader({ publicView = false }: { publicView?: boolean }) {
  return <header className="studio-nav">
    <Link href={publicView ? '/' : '/dashboard'} className="studio-brand" aria-label="ProfileHub ホーム"><span className="studio-mark"><Layers size={19} strokeWidth={1.6} /></span>ProfileHub<span className="studio-brand-label">STUDIO</span></Link>
    <nav aria-label="メインナビゲーション"><Link href="/x-monitor">X監視</Link>{!publicView && <Link href="/tools/link-generator">リンクツール</Link>}<Link href={publicView ? '/login' : '/dashboard'}>{publicView ? 'はじめる' : 'マイサイト'}<ArrowUpRight size={14} /></Link></nav>
  </header>;
}
