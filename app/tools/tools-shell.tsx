import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/**
 * /tools/* 共通のヘッダー・フッター。
 * メインサイト(app/page.tsx, app/dashboard/*)と同じ slate 基調のトンマナに揃えている。
 *
 * layout.tsx ではなくコンポーネントにしてあるのは、
 * /tools/link-generator がクッションページ(遅延リダイレクト画面)としても使われるため。
 * クッションページでは共通シェルをDOMに一切出したくない(遷移中は黒画面だけにする)ので、
 * ページ側が「シェルを着せるかどうか」を選べる形にしている。
 */
export function ToolsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Sparkles size={14} />
            </span>
            ProfileHub
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 transition hover:text-slate-900">
            マイサイト
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-slate-400">
          © {new Date().getFullYear()} ProfileHub
        </div>
      </footer>
    </div>
  );
}
