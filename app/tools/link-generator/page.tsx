import type { Metadata } from 'next';
import { CUSHION_PARAM, parseHttpUrl } from '@/lib/link-generator';
import { ToolsShell } from '../tools-shell';
import { LinkGeneratorForm } from './link-generator-form';
import { CushionRelay } from './cushion-relay';

/**
 * /tools/link-generator
 *
 * 単独版 index.html と同じく、1つのURLで2モードに分岐する。
 *   ?to= なし … ビルダー(生成フォーム)
 *   ?to= あり … クッションページ(遅延リダイレクト画面)
 *
 * この分岐をサーバーコンポーネントで行うことで、クッションページのURLを
 * SNSでシェアしたときのOGPタグを generateMetadata から出力できる
 * (クローラーはJSを実行しないため、クライアント側で分岐すると
 *  OGPタグを差し替えられない)。
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* ===== SNSシェア時のカード表示。文言・画像はここを書き換えれば変わる =====
   画像は同ディレクトリの opengraph-image.tsx が自動的に使われる。 */
const CUSHION_OG_TITLE = 'ProfileHub';
const CUSHION_OG_DESCRIPTION = 'リンクを開いて続きを確認してください。';

function firstValue(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const to = firstValue((await searchParams)[CUSHION_PARAM]);

  // クッションページとして開かれる場合。SNS/メッセージアプリに出るカードは
  // ツール名ではなくメインサイトのブランドで見せる。
  if (to !== null) {
    return {
      title: CUSHION_OG_TITLE,
      description: CUSHION_OG_DESCRIPTION,
      // 中継URLそのものは検索結果に載せない
      robots: { index: false, follow: false },
      openGraph: {
        type: 'website',
        siteName: 'ProfileHub',
        title: CUSHION_OG_TITLE,
        description: CUSHION_OG_DESCRIPTION,
      },
      twitter: {
        card: 'summary_large_image',
        title: CUSHION_OG_TITLE,
        description: CUSHION_OG_DESCRIPTION,
      },
    };
  }

  return {
    title: 'リンクジェネレーター | ProfileHub',
    description: '招待リンクから、ディープリンクをサニタイズした遷移用URLを生成します。',
    robots: { index: false, follow: false },
  };
}

export default async function LinkGeneratorPage({ searchParams }: { searchParams: SearchParams }) {
  const to = firstValue((await searchParams)[CUSHION_PARAM]);

  // ===== クッションページ(中継)モード =====
  // 遷移中は黒画面だけを見せたいので、共通シェル(ヘッダー・フッター)は着せない。
  if (to !== null) {
    // http/https 以外(javascript: 等)は location.href に到達させない
    const dest = parseHttpUrl(to);
    return <CushionRelay to={dest ? dest.toString() : null} />;
  }

  // ===== ビルダーモード =====
  return (
    <ToolsShell>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">最強リンク ジェネレーター</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          公式の短い招待リンクを入れるだけで、Lite強制誘導用の遷移URLを一発生成します。
        </p>
      </div>
      <LinkGeneratorForm />
    </ToolsShell>
  );
}
