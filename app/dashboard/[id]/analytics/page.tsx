import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSiteAnalytics } from '@/lib/analytics';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';

export default async function SiteAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: site } = await supabase
    .from('sites')
    .select('id, slug, title')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!site) notFound();

  const [summary7, summary30] = await Promise.all([
    getSiteAnalytics(supabase, site.id, 7),
    getSiteAnalytics(supabase, site.id, 30),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <Link href={`/dashboard/${site.id}`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} />
          編集画面に戻る
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">アクセス解析</h1>
        <p className="text-sm text-slate-400">{site.title || '(無題)'} / {site.slug}</p>
      </div>

      <AnalyticsPanel summary7={summary7} summary30={summary30} />
    </main>
  );
}
