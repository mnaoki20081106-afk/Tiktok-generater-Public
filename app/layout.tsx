import type { Metadata } from 'next';
import './globals.css';

/**
 * og:image などの相対URLを絶対URLへ展開するための基準オリジン。
 * NEXT_PUBLIC_SITE_URL(本番ドメイン)を最優先し、未設定ならVercelの払い出しURL、
 * どちらも無ければローカル開発用のURLにフォールバックする。
 */
function resolveMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'ProfileHub',
  description: '自分だけのプロフィール/ポートフォリオサイトを作成・公開できるサービス',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
