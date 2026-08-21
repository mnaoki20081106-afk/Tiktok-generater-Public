import { Loader2 } from 'lucide-react';

/** /dashboard 配下のページ遷移中に自動で表示される読み込み中UI */
export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Loading...</p>
      </div>
    </main>
  );
}
