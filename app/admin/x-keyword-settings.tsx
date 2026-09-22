import { Github, Plus, Trash2 } from 'lucide-react';
import type {
  XKeywordConfig,
  XKeywordKind,
} from '@/lib/x-monitor-github';
import {
  addXKeywordAction,
  removeXKeywordAction,
} from './x-keyword-actions';

const LABELS: Record<
  XKeywordKind,
  { title: string; description: string; placeholder: string }
> = {
  keywords: {
    title: '検索参考キーワード',
    description: 'X検索のOR条件を組み立てる参考ワードです。',
    placeholder: '追加する語句（改行・カンマ区切り）',
  },
  combo: {
    title: '組み合わせ検索',
    description: '1行を1つの検索式として扱います。',
    placeholder: '語句A AND 語句B\n別の検索式',
  },
  ng: {
    title: 'NGキーワード',
    description: '通知・候補判定から除外する語です。',
    placeholder: '追加する除外語（改行・カンマ区切り）',
  },
};

export function XKeywordSettings({
  config,
  canWrite,
  loadError,
}: {
  config: XKeywordConfig | null;
  canWrite: boolean;
  loadError: string | null;
}) {
  return (
    <section id="x-keywords" className="scroll-mt-8">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">X監視キーワード</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          ここで変更した内容はX-Bunsekiの既存キーワードファイルへ反映され、
          次回の監視から自動で使用されます。
        </p>
      </div>

      {loadError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          キーワード設定を読み込めませんでした。
          <span className="mt-1 block break-words text-xs text-red-500">{loadError}</span>
        </div>
      )}

      {!canWrite && (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>読み取り専用です。</strong>
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5">
            X_BUNSEKI_GITHUB_TOKEN
          </code>
          が本番環境で認識されると追加・削除が有効になります。
        </div>
      )}

      {config && (
        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(LABELS) as XKeywordKind[]).map((kind) => {
            const file = config[kind];
            const meta = LABELS[kind];

            return (
              <div
                key={kind}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{meta.title}</h3>
                    <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-medium text-cyan-700">
                      {file.values.length}件
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {meta.description}
                  </p>
                </div>

                <form action={addXKeywordAction} className="mb-4">
                  <input type="hidden" name="kind" value={kind} />
                  <textarea
                    name="values"
                    required
                    rows={kind === 'combo' ? 4 : 3}
                    disabled={!canWrite}
                    placeholder={meta.placeholder}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!canWrite}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={14} />
                    追加して監視へ反映
                  </button>
                </form>

                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {file.values.map((value) => (
                    <div
                      key={value}
                      className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 break-words text-xs leading-5 text-slate-700">
                        {value}
                      </span>
                      <form action={removeXKeywordAction}>
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="value" value={value} />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          title="削除"
                          aria-label={`${value}を削除`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        <Github size={15} className="mt-0.5 shrink-0" />
        <span>
          保存先はX-Bunseki/mainの
          <code className="mx-1">keywords.txt</code>、
          <code className="mx-1">keywords_combo.txt</code>、
          <code className="mx-1">keywords_ng.txt</code>です。
          GitHub tokenやXの認証情報はブラウザへ送信しません。
        </span>
      </div>
    </section>
  );
}
