import type { Metadata } from 'next';
import { resolveMetadataBase } from '@/lib/site-url';
import './globals.css';

/** Public metadata resolves to post-link.net in production. */
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
