import Link from 'next/link';
import { signInWithGoogle } from './actions';
import { StudioHeader } from '@/components/StudioHeader';
import { ArrowRight, Link2 } from 'lucide-react';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="studio-shell login-shell">
      <StudioHeader publicView />
      <main className="login-layout">
        <section className="login-intro">
          <p className="studio-eyebrow">A SPACE FOR YOUR IDEAS</p>
          <h1>そのアイデアを、<br /><span>次のリンクへ。</span></h1>
          <p>あなたのページをつくる、磨く、届ける。<br />すべてが、ここから。</p>
          <div className="login-sculpture" aria-hidden="true"><div /><Link2 size={80} strokeWidth={.8} /></div>
        </section>
      <section className="login-card" aria-labelledby="login-heading">
        <div className="login-card-heading">
          <p className="studio-eyebrow">WELCOME TO YOUR STUDIO</p>
          <h2 id="login-heading">ログイン</h2>
          <p>つくりかけのアイデアも、新しいひらめきも。<br />あなたのスタジオで続きを。</p>
        </div>

        {error && (
          <p role="alert" className="login-error">{error}</p>
        )}

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="login-google"
          >
            <GoogleIcon />
            Googleでログイン
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="login-session-note">
          ログイン状態はこのブラウザに保存され、次回は自動で管理画面を開きます。
          ログアウトや保存データの削除、セッションの失効後は再ログインが必要です。
        </p>

        <Link
          href="/"
          className="login-back"
        >
          トップに戻る
        </Link>
      </section>
      </main>
      <footer className="login-footer">ProfileHub Studio · Make it yours.</footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.4 0-13.8 4.1-17.1 10.1z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.6 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.9 39.6 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5C39.4 37.4 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
