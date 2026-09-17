import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BarChart3, ExternalLink, Pencil, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { isAdminEmail } from '@/lib/admin';
import { CreateSiteButton } from './create-site-button';
import { DeleteSiteButton } from './delete-site-button';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: sites } = await supabase
    .from('sites')
    .select('id, slug, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="studio-workspace">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="studio-eyebrow">YOUR WORKSPACE</p>
          <h1 className="workspace-title">マイサイト</h1>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdminEmail(user.email) && (
            <Link
              href="/admin"
              title="サプライズ抽選設定"
              className="flex items-center gap-1 rounded-lg border border-cyan-300/15 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-[#0c1c2d]"
            >
              <Settings size={13} />
              抽選設定
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <div className="workspace-toolbar">
        <div><h2>あなたのコレクション</h2><p>{sites?.length || 0} 件のサイト · つくったページを、ひとつの場所に。</p></div>
        <CreateSiteButton />
      </div>

      {!sites || sites.length === 0 ? (
        <p className="workspace-empty">
          まだサイトがありません。「新しいサイトを作成」から始めましょう。
        </p>
      ) : (
        <ul className="workspace-grid">
          {sites.map((site) => (
            <li
              key={site.id}
              className="workspace-card"
            >
              <div className="workspace-card-title">
                <div className="workspace-site-icon" aria-hidden="true"><ExternalLink size={22} strokeWidth={1.3} /></div>
                <p className="truncate text-sm font-semibold text-slate-100">{site.title || '(無題)'}</p>
                <p className="truncate text-xs text-slate-400">/{site.slug}</p>
              </div>
              <div className="workspace-card-actions">
                <Link
                  href={`/dashboard/${site.id}`}
                  className="flex items-center gap-1 rounded-lg border border-cyan-300/15 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-[#0c1c2d]"
                >
                  <Pencil size={13} />
                  編集
                </Link>
                <Link
                  href={`/dashboard/${site.id}/analytics`}
                  className="flex items-center gap-1 rounded-lg border border-cyan-300/15 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-[#0c1c2d]"
                >
                  <BarChart3 size={13} />
                  解析
                </Link>
                <a
                  href={`/${site.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg border border-cyan-300/15 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-[#0c1c2d]"
                >
                  <ExternalLink size={13} />
                  公開ページ
                </a>
                <DeleteSiteButton id={site.id} slug={site.slug} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
