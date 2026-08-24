import { ImageResponse } from 'next/og';

/**
 * クッションページ(/tools/link-generator?to=...)をSNSでシェアしたときに出るカード画像。
 * Next.jsのファイル規約なので、page.tsx の generateMetadata が返す openGraph に
 * 自動でマージされ、絶対URLの og:image / twitter:image として展開される。
 *
 * ImageResponse は既定でラテン文字のフォントしか持たないため、
 * 画像内の文字はラテン文字のみにしている(日本語の文言は og:title /
 * og:description 側で出す)。
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'ProfileHub';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 132,
            height: 132,
            borderRadius: 36,
            background: '#ffffff',
            color: '#0f172a',
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          P
        </div>
        <div style={{ marginTop: 44, fontSize: 76, fontWeight: 700, letterSpacing: -1 }}>ProfileHub</div>
        <div style={{ marginTop: 18, fontSize: 32, color: '#94a3b8' }}>Tap to continue</div>
      </div>
    ),
    size
  );
}
