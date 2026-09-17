import { StudioHeader } from '@/components/StudioHeader';

/**
 * /tools/* 共通のヘッダー・フッター。
 * メインサイトと共通のStudioナビゲーションとテーマを使う。
 *
 * layout.tsx ではなくコンポーネントにしてあるのは、
 * /tools/link-generator がクッションページ(遅延リダイレクト画面)としても使われるため。
 * クッションページでは共通シェルをDOMに一切出したくない(遷移中は黒画面だけにする)ので、
 * ページ側が「シェルを着せるかどうか」を選べる形にしている。
 */
export function ToolsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell utility-shell flex min-h-screen flex-col">
      <StudioHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-slate-400">
          © {new Date().getFullYear()} ProfileHub
        </div>
      </footer>
    </div>
  );
}
