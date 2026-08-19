import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
