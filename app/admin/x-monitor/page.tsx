import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  BrainCircuit,
  ExternalLink,
  Github,
  Plus,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import { formatCompactNumber, getXMonitorData } from '@/lib/x-monitor';
import {
  getXKeywordConfig,
  isXKeywordWriteConfigured,
  type XKeywordKind,
} from '@/lib/x-monitor-github';
import { addXKeywordAction, removeXKeywordAction } from './actions';

export const dynamic = 'force-dynamic';

const LABELS: Record<XKeywordKind, { title: string; description: string }> = {
  keywords: {
    title: '検索参考キーワード',
    description: 'keywords.txt。X検索のOR句に利用されます。',
  },
  combo: {
    title: '組み合わせ検索',
    description: 'keywords_combo.txt。1行を1つの検索式として扱います。',
  },
  ng: {
    title: 'NGキーワード',
    description: 'keywords_ng.txt。通知・候補判定から除外する語です。',
  },
};

export default async function XMonitorAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email)) redirect('/dashboard');

  const [keywords, monitor] = await Promise.all([
    getXKeywordConfig(),
    getXMonitorData(),
  ]);
  const canWrite = isXKeywordWriteConfigured();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin" className="flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-200">
          <ArrowLeft size={14} /> 管理画面へ戻る
        </Link>
        <Link href="/x-monitor" className="flex items-center gap-1 text-sm text-cyan-200 hover:text-cyan-100">
          公開ランキング <ExternalLink size={14} />
        </Link>
      </div>

      <section className="mb-10">
        <p className="studio-eyebrow">X MONITOR ADMIN</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">X監視・学習管理</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          変更は管理者認証をサーバー側で再確認した後、X-Bunsekiの設定ファイルへ直接反映します。
          次回監視から自動で使用されます。
        </p>
      </section>

      {!canWrite && (
        <div className="mb-8 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          <strong>読み取り専用です。</strong> 本番環境に
          <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">X_BUNSEKI_GITHUB_TOKEN</code>
          を設定すると追加・削除が有効になります。
        </div>
      )}

      <section className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="analytics-stat rounded-2xl border border-white/10 p-4">
          <Activity size={18} className="mb-3 text-cyan-200" />
          <p className="text-xs text-slate-500">監視状態</p>
          <strong className="mt-1 block text-lg text-slate-100">{monitor.status.status}</strong>
        </div>
        <div className="analytics-stat rounded-2xl border border-white/10 p-4">
          <BrainCircuit size={18} className="mb-3 text-cyan-200" />
          <p className="text-xs text-slate-500">Champion</p>
          <strong className="mt-1 block text-lg uppercase text-slate-100">{monitor.model.champion}</strong>
        </div>
        <div className="analytics-stat rounded-2xl border border-white/10 p-4">
          <p className="text-xs text-slate-500">学習サンプル</p>
          <strong className="mt-1 block text-lg text-slate-100">{formatCompactNumber(monitor.model.examples)}</strong>
          <span className="text-[10px] text-slate-500">completed {monitor.model.completedPosts}</span>
        </div>
        <div className="analytics-stat rounded-2xl border border-white/10 p-4">
          <p className="text-xs text-slate-500">Validation log-MAE</p>
          <strong className="mt-1 block text-lg text-slate-100">
            {monitor.model.validationLogMae == null ? '—' : monitor.model.validationLogMae.toFixed(4)}
          </strong>
          <span className="text-[10px] text-slate-500">model {monitor.model.modelVersion}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {(Object.keys(LABELS) as XKeywordKind[]).map((kind) => {
          const file = keywords[kind];
          const meta = LABELS[kind];
          return (
            <section key={kind} className="min-w-0 rounded-3xl border border-white/10 bg-[#101419] p-5">
              <div className="mb-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-slate-100">{meta.title}</h2>
                  <span className="rounded-full border border-cyan-200/15 px-2 py-1 text-[10px] text-cyan-100">
                    {file.values.length}件
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{meta.description}</p>
              </div>

              <form action={addXKeywordAction} className="mb-5">
                <input type="hidden" name="kind" value={kind} />
                <textarea
                  name="values"
                  required
                  rows={kind === 'combo' ? 4 : 3}
                  disabled={!canWrite}
                  placeholder={kind === 'combo' ? '語句A AND 語句B\n別の検索式' : '追加する語句（改行・カンマ区切り）'}
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/35 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-cyan-100 px-4 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={14} /> 追加してX-Bunsekiへ反映
                </button>
              </form>

              <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {file.values.map((value) => (
                  <div key={value} className="flex items-start gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                    <span className="min-w-0 flex-1 break-words text-xs leading-5 text-slate-300">{value}</span>
                    <form action={removeXKeywordAction}>
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="value" value={value} />
                      <button
                        type="submit"
                        disabled={!canWrite}
                        title="削除"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-400/10 hover:text-red-300 disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-slate-500">
        <Github size={17} className="mt-0.5 shrink-0 text-slate-400" />
        書き込み先は X-Bunseki/main の keywords.txt / keywords_combo.txt / keywords_ng.txt です。
        auth_token・ct0・GitHub tokenはブラウザへ渡しません。
      </div>
    </main>
  );
}
