import Link from 'next/link';
import { ArrowLeft, ExternalLink, Radar } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin';
import { getGlobalAnalytics, getGlobalAnalyticsHourly } from '@/lib/analytics';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { AdminSurpriseForm } from './admin-surprise-form';
import { isIpHashingConfigured } from '@/lib/request-identity';
import { getXKeywordConfig, isXKeywordWriteConfigured } from '@/lib/x-monitor-github';
import { XKeywordSettings } from './x-keyword-settings';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  const admin = createAdminClient();
  const [{ data: config }, summary24h, summary7, summary30, xKeywordsResult] = await Promise.all([
    admin.from('surprise_config').select('*').eq('id', 1).maybeSingle(),
    getGlobalAnalyticsHourly(admin, 24),
    getGlobalAnalytics(admin, 7),
    getGlobalAnalytics(admin, 30),
    getXKeywordConfig()
      .then((keywords) => ({ keywords, error: null as string | null }))
      .catch((error: unknown) => ({
        keywords: null,
        error: error instanceof Error ? error.message : 'キーワード設定の取得に失敗しました',
      })),
  ]);
  const canWriteXKeywords = isXKeywordWriteConfigured();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-6 sm:py-12">
      <Link href="/dashboard" className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={14} />
        マイサイト一覧に戻る
      </Link>

      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="studio-eyebrow">ADMIN CONSOLE</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">管理画面</h1>
          <p className="mt-2 text-sm text-slate-500">
            利用状況、X監視キーワード、サプライズ抽選を管理します。
          </p>
        </div>
        <Link
          href="/x-monitor"
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800 transition hover:bg-cyan-100"
        >
          <Radar size={15} /> X監視ランキング <ExternalLink size={13} />
        </Link>
      </div>

      <h2 className="mb-2 text-xl font-semibold text-slate-900">利用状況</h2>
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

      <div className="mb-14 border-t border-slate-200 pt-10">
        <XKeywordSettings
          config={xKeywordsResult.keywords}
          canWrite={canWriteXKeywords}
          loadError={xKeywordsResult.error}
        />
      </div>

      <div className="border-t border-slate-200 pt-10">
      <h2 className="mb-2 text-xl font-semibold text-slate-900">サプライズ抽選設定</h2>
      <p className="mb-8 text-sm leading-relaxed text-slate-500">
        訪問者が公開ページの「TikTokを開く」ボタンをタップした際、指定した確率でユーザー入力のURLの代わりに
        当たりURLへ遷移させます。サイト作成者本人のログイン、端末Cookie、ブラウザ指紋、秘密鍵付きIPハッシュの
        いずれかが一致するアクセスは、常にユーザーが入力した本来のURLへ遷移します。
      </p>
      {!isIpHashingConfigured() && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          <strong>IPによる作成者除外が未設定です。</strong><br />
          GitHub／ホスティング環境のSecretに、32文字以上のランダムな
          <code className="mx-1 font-mono">IP_HASH_SECRET</code>を追加してください。
          Cookie・ログイン・ブラウザ指紋による除外は引き続き動作します。
        </div>
      )}
      <AdminSurpriseForm config={config} />
      </div>
    </main>
  );
}
