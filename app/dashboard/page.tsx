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
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">マイサイト</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdminEmail(user.email) && (
            <Link
              href="/admin"
              title="サプライズ抽選設定"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              <Settings size={13} />
              抽選設定
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>

      <div className="mb-6">
        <CreateSiteButton />
      </div>

      {!sites || sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
          まだサイトがありません。「新しいサイトを作成」から始めましょう。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sites.map((site) => (
            <li
              key={site.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{site.title || '(無題)'}</p>
                <p className="truncate text-xs text-slate-400">/{site.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Link
                  href={`/dashboard/${site.id}`}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  <Pencil size={13} />
                  編集
                </Link>
                <Link
                  href={`/dashboard/${site.id}/analytics`}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  <BarChart3 size={13} />
                  解析
                </Link>
                <a
                  href={`/${site.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
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
