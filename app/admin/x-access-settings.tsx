import { KeyRound, Plus, Trash2 } from 'lucide-react';
import type { XMonitorAllowlist } from '@/lib/x-monitor-access-store';
import {
  addXMonitorAccessAction,
  removeXMonitorAccessAction,
} from './x-access-actions';

export function XMonitorAccessSettings({
  allowlist,
  billingConfigured,
  loadError,
}: {
  allowlist: XMonitorAllowlist | null;
  billingConfigured: boolean;
  loadError: string | null;
}) {
  return (
    <section id="x-monitor-access" className="scroll-mt-8">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">X監視アクセス管理</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          X監視は「管理者」「ここで個別許可したメールアドレス」「有効な月額契約」のいずれかだけが利用できます。
          サイト作成機能にはこの制限をかけません。
        </p>
      </div>

      {loadError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          許可リストを読み込めませんでした。
          <span className="mt-1 block break-words text-xs text-red-500">{loadError}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={17} className="text-cyan-700" />
            <h3 className="font-semibold text-slate-900">個別許可メール</h3>
          </div>

          <form action={addXMonitorAccessAction} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              name="email"
              required
              autoComplete="off"
              placeholder="user@example.com"
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-cyan-400 focus:bg-white"
            />
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus size={14} /> 許可
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {(allowlist?.emails || []).length ? (
              allowlist!.emails.map((email) => (
                <div
                  key={email}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{email}</span>
                  <form action={removeXMonitorAccessAction}>
                    <input type="hidden" name="email" value={email} />
                    <button
                      type="submit"
                      aria-label={`${email} の許可を解除`}
                      title="許可を解除"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                個別許可はまだありません。
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-800">月額契約</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            StripeのPrice IDとSecretをサーバー環境に設定すると、契約中ユーザーを自動判定します。
          </p>
          <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            billingConfigured
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-800'
          }`}>
            {billingConfigured ? '決済設定済み' : '決済設定未完了'}
          </span>
        </div>
      </div>
    </section>
  );
}
