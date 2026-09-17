import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { DashboardForm } from '../dashboard-form';

export default async function EditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: site } = await supabase.from('sites').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();

  if (!site) {
    notFound();
  }

  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const siteUrlOrigin = `${protocol}://${host}`;

  return (
    <main className="studio-workspace">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-100">
            <ArrowLeft size={14} />
            マイサイト一覧に戻る
          </Link>
          <h1 className="workspace-title mt-5">サイトを編集</h1>
          <p className="text-sm text-slate-400">仕上がりを見ながら、あなたらしい一枚に。</p>
        </div>
        <Link
          href={`/dashboard/${site.id}/analytics`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/15 bg-[#0c1b2d] px-3 py-2 text-sm text-slate-300 transition hover:bg-[#0c1c2d]"
        >
          <BarChart3 size={15} />
          アクセス解析
        </Link>
      </div>

      <DashboardForm userId={user.id} site={site} siteUrlOrigin={siteUrlOrigin} />
    </main>
  );
}
