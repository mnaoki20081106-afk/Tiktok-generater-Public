import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { signIn, signUp } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
            <LogIn size={18} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">ログイン / 新規登録</h1>
          <p className="text-sm text-slate-500">
            メールアドレスとパスワードでログインできます
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {message && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
            {message}
          </p>
        )}

        <form className="flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="6文字以上"
            />
          </div>

          <div className="mt-2 flex flex-col gap-2">
            <button
              formAction={signIn}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              ログイン
            </button>
            <button
              formAction={signUp}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              新規登録
            </button>
          </div>
        </form>

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-slate-400 hover:text-slate-600"
        >
          トップに戻る
        </Link>
      </div>
    </main>
  );
}
