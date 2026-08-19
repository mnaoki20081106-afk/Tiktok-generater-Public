import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">404</h1>
      <p className="text-slate-500">お探しのページは見つかりませんでした。</p>
      <Link href="/" className="mt-2 text-sm text-slate-700 underline underline-offset-4">
        トップに戻る
      </Link>
    </main>
  );
}
