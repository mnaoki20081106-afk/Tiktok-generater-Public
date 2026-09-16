export type TemplateMode = 'news' | 'instagram' | 'instagram-live' | 'live' | 'x' | 'tiktok' | 'youtube' | 'file';

type TemplateData = {
  templateMode: TemplateMode;
  title: string;
  tiktokUrl: string;
  slug: string;
  username: string;
  description: string;
  likeCount: string;
  commentCount: string;
  shareCount: string;
  avatarUrl: string;
  backgroundUrl: string;
  ogpImageUrl: string;
  origin: string;
};

function esc(value: unknown): string {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string
  );
}

function shell(d: TemplateData, content: string): string {
  const title = esc(d.title || 'リンクを開く');
  const description = esc(d.description);
  const ogp = esc(d.ogpImageUrl);
  const pageUrl = esc(`${d.origin}/${d.slug}`);
  const href = esc(d.tiktokUrl);
  const slugJson = JSON.stringify(String(d.slug || '')).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${ogp}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogp}">
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Sans",sans-serif;background:#eef1f5;color:#101114}
body{display:flex;justify-content:center}.screen{position:relative;width:100%;max-width:480px;min-height:100dvh;background:#fff;overflow:hidden;box-shadow:0 0 40px rgba(0,0,0,.16)}
.hero{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:#17191d}.avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#d8dce2}.top{height:58px;display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid #eceef1;background:#fff;position:relative;z-index:2}.brand{font-size:20px;font-weight:900;letter-spacing:-.5px}.user{min-width:0}.name{font-size:14px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;color:#6b7280}.body{padding:15px}.title{font-size:21px;line-height:1.35;font-weight:850;letter-spacing:-.3px}.desc{margin-top:8px;font-size:14px;line-height:1.65;color:#474c55;white-space:pre-wrap}.actions{display:flex;justify-content:space-between;gap:12px;padding:13px 15px;font-size:13px;color:#606773;border-top:1px solid #eceef1}.tap{position:fixed;inset:0;z-index:50;color:transparent;text-decoration:none}.cta{margin-top:16px;border-radius:12px;padding:13px 16px;text-align:center;background:#111;color:#fff;font-size:15px;font-weight:800}.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}.liveDot{width:7px;height:7px;border-radius:50%;background:#fff;animation:pulse 1.1s infinite}@keyframes pulse{50%{opacity:.35}}
/* news */
.news .top{background:#fff}.news .brand{color:#df0a22}.news .breaking{background:#df0a22;color:#fff;border-radius:0;padding:8px 14px;font-weight:900;font-size:12px;letter-spacing:.08em}.news .hero{aspect-ratio:16/10}.news .title{font-family:Georgia,"Yu Mincho",serif;font-size:25px}.news .ticker{margin-top:18px;border-left:4px solid #df0a22;padding-left:10px;font-size:12px;font-weight:700;color:#555}
/* instagram */
.instagram .brand{font-family:cursive;font-size:24px}.instagram .hero{aspect-ratio:1}.instagram .igicons{font-size:23px;letter-spacing:7px}.instagram .likes{padding:12px 15px 0;font-size:13px;font-weight:800}.instagram .body{padding-top:7px}.instagram .title{font-size:14px;display:inline}.instagram .desc{display:inline;margin-left:6px;color:#222}.instagram .cta{background:linear-gradient(45deg,#f9ce34,#ee2a7b 52%,#6228d7)}
/* live */
.instagram-live,.live{background:#111;color:#fff}.instagram-live .top,.live .top{background:linear-gradient(180deg,rgba(0,0,0,.68),transparent);border:0;position:absolute;inset:0 0 auto;color:#fff}.instagram-live .avatar{border:2px solid #fa2b72}.instagram-live .badge{background:#fa2b72;color:#fff}.live .badge{background:#ff7900;color:#fff}.instagram-live .hero,.live .hero{height:100dvh;aspect-ratio:auto}.chat{position:absolute;left:15px;right:74px;bottom:84px;z-index:3}.chat p{margin:8px 0;font-size:13px;text-shadow:0 1px 4px #000}.chat b{margin-right:5px}.hearts{position:absolute;right:20px;bottom:92px;font-size:26px;line-height:1.55}.live .chat p{background:rgba(0,0,0,.42);border-radius:8px;padding:7px 9px}.live .top{border-top:4px solid #ff7900}
/* x */
.x .top{justify-content:center;height:52px}.x .brand{font-size:26px}.x .post{padding:14px 16px}.x .posthead{display:flex;gap:10px}.x .postcopy{flex:1}.x .title{font-size:15px}.x .desc{font-size:15px;color:#16181c}.x .hero{aspect-ratio:16/10;border-radius:14px;margin-top:12px;border:1px solid #d8dde3}.x .actions{padding-left:0;padding-right:0;border:0}
/* youtube */
.youtube .brand{color:#0f0f0f}.youtube .ytmark{color:#fff;background:#f00;border-radius:7px;padding:2px 7px;margin-right:4px}.youtube .hero{aspect-ratio:16/9}.youtube .play{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);width:66px;height:46px;border-radius:13px;background:#f00;color:#fff;display:grid;place-items:center;font-size:25px}.youtube .channel{display:flex;align-items:center;gap:10px;margin-top:17px}.youtube .subscribe{margin-left:auto;background:#0f0f0f;color:#fff;padding:9px 14px;border-radius:20px;font-size:12px;font-weight:800}
/* file */
.file{background:#f4f7fb;display:flex;flex-direction:column}.file .top{border:0;background:#155dfc;color:#fff}.file .brand{font-size:18px}.file .filecard{margin:auto 20px;background:#fff;border-radius:22px;padding:30px 24px;text-align:center;box-shadow:0 18px 50px rgba(30,64,175,.13)}.file .fileicon{width:84px;height:102px;margin:0 auto 22px;border-radius:13px;background:#e7efff;color:#155dfc;display:grid;place-items:center;font-size:34px;font-weight:900}.file .title{font-size:19px;word-break:break-word}.file .desc{font-size:13px}.file .cta{background:#155dfc;margin-top:24px}.file .safe{margin-top:14px;font-size:11px;color:#87909f}
</style></head><body>
<main class="screen ${esc(d.templateMode)}">${content}</main>
<a class="tap" href="${href}" target="_top" rel="noreferrer noopener" aria-label="リンク先を開く">リンク先を開く</a>
<script>(function(){var link=document.querySelector('.tap');var slug=${slugJson};if(!link)return;var s=document.createElement('script');s.src='/fp.js';s.async=true;s.onload=function(){if(!window.FingerprintJS)return;window.FingerprintJS.load().then(function(a){return a.get()}).then(function(r){return fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:slug,fp:r.visitorId})})}).then(function(r){return r&&r.ok?r.json():null}).then(function(d){if(d&&d.href)link.href=d.href}).catch(function(){})};document.head.appendChild(s)})();</script>
</body></html>`;
}

function avatar(d: TemplateData): string {
  return `<img class="avatar" src="${esc(d.avatarUrl)}" alt="">`;
}

function image(d: TemplateData): string {
  return `<img class="hero" src="${esc(d.backgroundUrl)}" alt="">`;
}

export function renderAlternateViewerHtml(d: TemplateData): string {
  const name = esc(d.username || d.slug);
  const title = esc(d.title || 'リンクを開く');
  const desc = esc(d.description);
  const likes = esc(d.likeCount);
  const comments = esc(d.commentCount);
  const shares = esc(d.shareCount);
  let content = '';

  switch (d.templateMode) {
    case 'news':
      content = `<header class="top"><span class="brand">NEWS NOW</span><span class="sub">24/7</span></header><div class="breaking">BREAKING NEWS</div>${image(d)}<section class="body"><h1 class="title">${title}</h1><p class="desc">${desc}</p><p class="ticker">最新情報をお届けしています　｜　タップして記事を読む</p><div class="cta">記事の続きを読む</div></section>`;
      break;
    case 'instagram':
      content = `<header class="top"><span class="brand">Instagram</span></header><div class="top">${avatar(d)}<div class="user"><div class="name">${name}</div><div class="sub">おすすめ</div></div><b style="margin-left:auto">•••</b></div>${image(d)}<div class="actions"><span class="igicons">♡ ◯ ✈</span><span>▢</span></div><div class="likes">${likes}件の「いいね！」</div><section class="body"><b class="title">${name}</b><span class="desc">${desc}</span><div class="cta">プロフィールのリンクを開く</div></section>`;
      break;
    case 'instagram-live':
      content = `${image(d)}<header class="top">${avatar(d)}<div class="user"><div class="name">${name}</div><div class="sub" style="color:#fff">${likes}人が視聴中</div></div><span class="badge"><i class="liveDot"></i>LIVE</span><b style="margin-left:auto">×</b></header><div class="chat"><p><b>mika</b>すごい！</p><p><b>haru</b>${desc || '配信を見ています'}</p><p><b>yui</b>続きが気になる 👏</p></div><div class="hearts">♡<br>♥<br>♡</div>`;
      break;
    case 'live':
      content = `${image(d)}<header class="top">${avatar(d)}<div class="user"><div class="name">${name}</div><div class="sub" style="color:#fff">${likes} viewers</div></div><span class="badge"><i class="liveDot"></i>LIVE</span></header><div class="chat"><p><b>LIVE CHAT</b></p><p><b>guest_24</b>${desc || '配信に参加しました'}</p><p><b>viewer</b>続きを見る →</p></div>`;
      break;
    case 'x':
      content = `<header class="top"><span class="brand">𝕏</span></header><article class="post"><div class="posthead">${avatar(d)}<div class="postcopy"><b class="name">${name}</b><div class="sub">@${name} · 今</div><p class="desc">${desc || title}</p>${image(d)}<div class="actions"><span>♡ ${likes}</span><span>◯ ${comments}</span><span>↗ ${shares}</span></div></div></div><div class="cta">リンクを開く</div></article>`;
      break;
    case 'youtube':
      content = `<header class="top"><span class="brand"><span class="ytmark">▶</span>YouTube</span></header>${image(d)}<span class="play">▶</span><section class="body"><h1 class="title">${title}</h1><p class="sub">${likes} 回視聴 · 今</p><div class="channel">${avatar(d)}<div><b class="name">${name}</b><div class="sub">チャンネル</div></div><span class="subscribe">登録</span></div><p class="desc">${desc}</p><div class="cta">YouTubeで見る</div></section>`;
      break;
    case 'file':
      content = `<header class="top"><span class="brand">Secure Share</span></header><section class="filecard"><div class="fileicon">↓</div><h1 class="title">${title}</h1><p class="desc">${desc || '共有ファイルを受け取りました'}</p><div class="cta">ファイルを開く</div><p class="safe">🔒 安全な接続で共有されています</p></section>`;
      break;
    default:
      content = '';
  }
  return shell(d, content);
}
