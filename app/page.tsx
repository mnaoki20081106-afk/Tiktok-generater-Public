import Link from 'next/link';
import { Sparkles, Link2, Smartphone } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Sparkles size={22} />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900 sm:text-4xl">
        あなただけのプロフィールサイトを、
        <br />
        数分で公開しよう
      </h1>
      <p className="mt-4 max-w-md text-slate-500">
        アカウントを作成してタイトル・自己紹介・画像を入力するだけ。
        自分専用のURLで、誰でも見られるポートフォリオページが完成します。
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          はじめる / ログイン
        </Link>
      </div>

      <div className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
        <Feature
          icon={<Link2 size={18} />}
          title="専用URL"
          description="/自分のslug で世界に公開できます"
        />
        <Feature
          icon={<Smartphone size={18} />}
          title="端末に自動保存"
          description="編集中の内容は端末にも自動保存され、安心して編集できます"
        />
        <Feature
          icon={<Sparkles size={18} />}
          title="かんたん編集"
          description="ダッシュボードでテキストと画像を入力するだけ"
        />
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
