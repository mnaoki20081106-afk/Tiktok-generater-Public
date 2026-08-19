import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
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
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} />
          マイサイト一覧に戻る
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">サイトを編集</h1>
      </div>

      <DashboardForm userId={user.id} site={site} siteUrlOrigin={siteUrlOrigin} />
    </main>
  );
}
