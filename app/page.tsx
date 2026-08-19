import { Sparkles, Link2, KeyRound } from 'lucide-react';
import { createSite } from './edit/actions';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Sparkles size={22} />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-slate-900 sm:text-4xl">
        TikTok風プロフィールサイトを、
        <br />
        アカウント登録なしで公開しよう
      </h1>
      <p className="mt-4 max-w-md text-slate-500">
        「新しいサイトを作る」を押すだけで、あなた専用の編集リンクが発行されます。
        ログインは不要です。その編集リンクをブックマークしておけば、いつでも内容を更新できます。
      </p>

      <div className="mt-8 flex gap-3">
        <form action={createSite}>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            新しいサイトを作る
          </button>
        </form>
      </div>

      <div className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
        <Feature icon={<Link2 size={18} />} title="専用URL" description="/自分のslug で世界に公開できます" />
        <Feature
          icon={<KeyRound size={18} />}
          title="秘密の編集リンク"
          description="ログイン不要。発行された編集リンクを知っている人だけが編集できます"
        />
        <Feature
          icon={<Sparkles size={18} />}
          title="タップして編集"
          description="プレビューを直接タップして、TikTok風の見た目そのままに編集できます"
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
