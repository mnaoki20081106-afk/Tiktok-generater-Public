import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, ExternalLink, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { createSite } from './actions';
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
        <LogoutButton />
      </div>

      <form action={createSite} className="mb-6">
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          <Plus size={16} />
          新しいサイトを作成
        </button>
      </form>

      {!sites || sites.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
          まだサイトがありません。「新しいサイトを作成」から始めましょう。
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sites.map((site) => (
            <li
              key={site.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{site.title || '(無題)'}</p>
                <p className="truncate text-xs text-slate-400">/{site.slug}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/dashboard/${site.id}`}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  <Pencil size={13} />
                  編集
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
