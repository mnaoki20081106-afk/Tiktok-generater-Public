import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';
import { getGlobalAnalytics, getGlobalAnalyticsHourly } from '@/lib/analytics';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { AdminSurpriseForm } from './admin-surprise-form';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  const admin = createAdminClient();
  const [{ data: config }, summary24h, summary7, summary30] = await Promise.all([
    admin.from('surprise_config').select('*').eq('id', 1).maybeSingle(),
    getGlobalAnalyticsHourly(admin, 24),
    getGlobalAnalytics(admin, 7),
    getGlobalAnalytics(admin, 30),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <Link href="/dashboard" className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} />
        マイサイト一覧に戻る
      </Link>

      <h1 className="mb-2 text-xl font-semibold text-slate-900">利用状況</h1>
      <p className="mb-4 text-sm text-slate-500">管理者のみが見られる、ジェネレーター全体の利用状況です。</p>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">登録ユーザー数</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900">{summary30.userCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">作成されたサイト数</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900">{summary30.siteCount.toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-12">
        <AnalyticsPanel
          summary24h={summary24h}
          summary7={summary7}
          summary30={summary30}
          pvLabel="全サイト合計PV"
          uuLabel="全サイト合計UU"
        />
      </div>

      <h2 className="mb-2 text-xl font-semibold text-slate-900">サプライズ抽選設定</h2>
      <p className="mb-8 text-sm leading-relaxed text-slate-500">
        訪問者が公開ページの「TikTokを開く」ボタンをタップした際、指定した確率でユーザー入力のURLの代わりに
        当たりURLへ遷移させます。サイト作成者本人の端末・同一アカウントでログイン済みの端末からのアクセスは、
        常にユーザーが入力した本来のURLへ遷移します(自作自演での不正取得を防ぐため)。
      </p>
      <AdminSurpriseForm config={config} />
    </main>
  );
}
