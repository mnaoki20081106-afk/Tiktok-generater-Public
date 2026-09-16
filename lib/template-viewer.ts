import { previewEditorHtml } from './template-preview-editor.ts';
import { TEMPLATE_LAYOUTS } from './template-layouts.ts';

export type TemplateMode = 'news' | 'instagram' | 'instagram-live' | 'live' | 'x' | 'tiktok' | 'youtube' | 'file';
export type TemplateRow = { title?: string; name?: string; image?: string; url?: string; draftImageKey?: string };
export type TemplateOptions = {
  heading?: string; publisher?: string; body?: string; headline?: string; cta?: string;
  channel?: string; handle?: string; duration?: string; ago?: string; teaser?: string;
  notice?: string; badge?: string; comments?: string; videoUrl?: string; accent?: string;
  play?: boolean; loop?: boolean; tapAll?: boolean; rows?: TemplateRow[];
};
export type TemplateSettings = Partial<Record<TemplateMode, TemplateOptions>>;
export type TemplateData = {
  templateMode: TemplateMode; title: string; tiktokUrl: string; slug: string; username: string;
  description: string; likeCount: string; commentCount: string; shareCount: string;
  avatarUrl: string; backgroundUrl: string; ogpImageUrl: string; origin: string;
  templateSettings?: TemplateSettings;
};

export const TEMPLATE_FIELDS: Partial<Record<TemplateMode, { key: keyof TemplateOptions; label: string; multiline?: boolean; placeholder?: string }[]>> = {
  news: [{ key: 'heading', label: '記事の見出し' }, { key: 'publisher', label: '媒体名' }, { key: 'body', label: '本文', multiline: true }, { key: 'duration', label: '動画の長さ', placeholder: '1:35' }, { key: 'badge', label: 'バッジ（空欄で非表示）' }],
  instagram: [{ key: 'heading', label: 'アカウント名' }, { key: 'headline', label: '見出し文', multiline: true }],
  'instagram-live': [{ key: 'heading', label: 'アカウント名' }, { key: 'notice', label: 'おしらせの文', multiline: true }, { key: 'comments', label: '流れるコメント（1行に1つ）', multiline: true }],
  live: [{ key: 'heading', label: '配信者名' }, { key: 'accent', label: 'アクセントカラー', placeholder: '#ff4f9a' }, { key: 'comments', label: '流れるコメント（1行に1つ）', multiline: true }],
  x: [{ key: 'heading', label: '表示名' }, { key: 'handle', label: 'ユーザー名（@）' }, { key: 'body', label: '投稿文', multiline: true }],
  youtube: [{ key: 'heading', label: '動画のタイトル' }, { key: 'channel', label: 'チャンネル名' }, { key: 'handle', label: 'ハンドル（@）' }, { key: 'duration', label: '動画の長さ', placeholder: '8:24' }, { key: 'ago', label: '投稿からの経過', placeholder: '3 日前' }, { key: 'teaser', label: '先頭のコメント' }],
  file: [{ key: 'heading', label: 'フォルダ名' }],
};
export function defaultTemplateOptions(mode: TemplateMode, d: Pick<TemplateData, 'title' | 'username' | 'description'>): TemplateOptions {
  const account = d.username || 'your_account';
  const ctas: Record<string, string> = { news: '記事全文を読む', instagram: 'Instagramを開く', 'instagram-live': '参加をリクエスト', live: 'フォローする', x: '開く', youtube: 'チャンネル登録', file: '' };
  return {
    heading: ['instagram', 'instagram-live', 'live', 'x'].includes(mode) ? account : d.title,
    publisher: '', body: d.description, headline: d.description || `${account}のストーリーズが消える前にチェックしよう`,
    cta: ctas[mode] ?? '', channel: account, handle: account, duration: mode === 'youtube' ? '8:24' : '1:35',
    ago: '3 日前', teaser: '', notice: `${account}のライブ動画への参加リクエストを送信できます。`,
    comments: mode === 'live' ? 'こんばんは〜\n初見です！\n待ってた' : 'きたー！\nまってました\n今日も見てます',
    play: mode !== 'instagram', loop: true, tapAll: true, badge: '',
    rows: mode === 'file' ? ['IMG_4821.JPG', 'IMG_4822.JPG', 'IMG_4823.JPG', 'IMG_4824.JPG'].map(name => ({ name }))
      : mode === 'youtube' ? ['【保存版】これだけは知っておきたい基本', 'やってはいけない3つのこと', '初心者がつまずくポイントまとめ'].map(title => ({ title })) : [],
  };
}
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
// URLs appear in both HTML attributes and quoted CSS url(). Restrict schemes and
// encode syntax characters before HTML escaping. blob: is allowed only in the editor.
function safeUrl(value: unknown, preview = false): string {
  const raw = String(value ?? '');
  if (preview && /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:', ...(preview ? ['blob:'] : [])].includes(url.protocol)) return '';
    return url.href.replace(/[\s'"<>\\(){}]/g, c => encodeURIComponent(c).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29'));
  } catch { return ''; }
}
function fill(template: string, values: Record<string, string>): string {
  // A single pass ensures user text containing {{tokens}} is never interpreted.
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '');
}

export function renderAlternateViewerHtml(d: TemplateData, { preview = false, editorToken = '' }: { preview?: boolean; editorToken?: string } = {}): string {
  const mode = d.templateMode === 'tiktok' ? 'news' : d.templateMode;
  const layout = TEMPLATE_LAYOUTS[mode] ?? TEMPLATE_LAYOUTS.news;
  const o = { ...defaultTemplateOptions(mode, d), ...d.templateSettings?.[mode] };
  const destination = safeUrl(d.tiktokUrl) || '#';
  const image = safeUrl(d.backgroundUrl || d.ogpImageUrl, preview);
  const avatar = safeUrl(d.avatarUrl, preview) || image;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(o)) if (typeof value === 'string') values[key] = esc(value).replace(/\n/g, '<br>');
  Object.assign(values, {
    title: esc(o.heading ?? d.title), href: esc(destination), image: esc(image), avatar: esc(avatar),
    handle: esc((o.handle || d.username).replace(/^@/, '')),
    likeCount: esc(d.likeCount || '0'), commentCount: esc(d.commentCount || '0'), shareCount: esc(d.shareCount || '0'),
  });
  const rows = Array.isArray(o.rows) ? o.rows.slice(0, mode === 'file' ? 12 : 6) : [];
  values.itemCount = String(rows.length);
  if (mode === 'file' && !o.cta) values.cta = `Download ${rows.length} items as ZIP`;
  if ('row' in layout) {
    values.rows = rows.map(row => {
      const rowUrl = safeUrl(row.url);
      const snippet = rowUrl ? layout.row.replace('class="lc-go ', 'style="position:relative;z-index:9100" class="lc-hit ') : layout.row;
      return fill(snippet, { ...values, rowTitle: esc(row.title), rowName: esc(row.name), image: esc(safeUrl(row.image, preview) || image), href: esc(rowUrl || destination) });
    }).join('');
  }
  if ('comments' in layout) {
    const comments = String(o.comments || '').split('\n').filter(Boolean).slice(0, 30);
    const prefix = mode === 'live' ? 'lv' : 'il';
    // Use the reference row's avatar and typography, one row per editable comment.
    const commentRows = layout.comments.match(new RegExp('<div class="' + prefix + '-cm">.*?</p></div></div>', 'gs')) || [];
    values.comments = comments.map((comment, index) => fill(commentRows[index % commentRows.length] || '', { commentOne: esc(comment), commentTwo: esc(comment) })).join('');
  }
  let bodyTemplate: string = layout.body;
  if (!o.badge && !(preview && editorToken)) bodyTemplate = bodyTemplate.replace(/<[^>]+class="a-badge"[^>]*>.*?<\/[^>]+>/g, '');
  if (o.play === false) bodyTemplate = bodyTemplate.replace(/<(span|div)[^>]*class="(?:v|ig|il|lv|x|yt)-play"[^>]*>[\s\S]*?<\/\1>/g, '');
  if (mode === 'youtube') bodyTemplate = bodyTemplate.replace('<b>コメント</b><span>60</span>', '<b>コメント</b><span>{{commentCount}}</span>');
  const video = safeUrl(o.videoUrl);
  if (video && ['news', 'youtube', 'live', 'instagram-live'].includes(mode)) {
    bodyTemplate = bodyTemplate.replace(/<img class="v-media"[^>]*>|<div class="((?:yt|il|lv)-v) [^"]*"[^>]*><\/div>/, (_m, cls: string) =>
      `<video class="${cls || 'v-media'}" src="${esc(video)}" poster="{{image}}" muted autoplay playsinline ${o.loop !== false ? 'loop' : ''} style="object-fit:cover;width:100%;height:100%"></video>`);
  }
  let body = fill(bodyTemplate, values);
  body = body.replace(/<a /g, '<a target="_top" rel="noreferrer noopener" ');
  if (o.tapAll !== false) body += `<a class="lc-go lc-tapall" href="${esc(destination)}" target="_top" rel="noreferrer noopener" aria-label="リンク先を開く"></a>`;
  const css = mode === 'live' && /^#[\da-f]{6}$/i.test(o.accent || '') ? layout.css.replace(/#FF7A00/g, o.accent!) : layout.css;
  const slugJson = JSON.stringify(d.slug).replace(/</g, '\\u003c');
  const animation = !preview && ['live', 'instagram-live'].includes(mode) ? `<script>(function(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var prefix=${JSON.stringify(mode === 'live' ? 'lv' : 'il')};
    var feed=document.querySelector('.'+prefix+'-feed-in');if(!feed||feed.children.length<2)return;
    var pool=Array.from(feed.children).map(function(n){return n.cloneNode(true)});var queue=[];
    while(feed.children.length>3)feed.firstChild.remove();
    function tick(){if(!queue.length)queue=pool.map(function(n){return n.cloneNode(true)}).sort(function(){return Math.random()-.5});
      var n=queue.shift();n.classList.add(prefix+'-cm-new');feed.appendChild(n);while(feed.children.length>14)feed.firstChild.remove();
      var r=Math.random();setTimeout(tick,r<.72?700+Math.random()*2300:r<.9?260+Math.random()*420:4000+Math.random()*3000)}
    setTimeout(tick,500+Math.random()*900);
  })();</script>` : '';
  const tracking = preview ? '' : `<script>(function(){
    var s=document.createElement('script');s.src='/fp.js';s.async=true;
    s.onload=function(){if(!window.FingerprintJS)return;window.FingerprintJS.load().then(function(a){return a.get()}).then(function(r){return fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:${slugJson},fp:r.visitorId})})}).then(function(r){return r&&r.ok?r.json():null}).then(function(d){if(!d||!d.href)return;try{var u=new URL(d.href);if(!/^https?:$/.test(u.protocol))return;document.querySelectorAll('a.lc-go').forEach(function(a){a.href=u.href})}catch(e){}}).catch(function(){})};document.head.appendChild(s);
  })();</script>`;
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>${esc(d.title)}</title>
<meta property="og:title" content="${esc(d.title)}"><meta property="og:description" content="${esc(d.description)}"><meta property="og:image" content="${esc(safeUrl(d.ogpImageUrl, preview))}"><meta property="og:url" content="${esc(safeUrl(`${d.origin}/${d.slug}`))}"><meta property="og:type" content="${mode === 'news' ? 'article' : 'website'}"><meta name="twitter:card" content="summary_large_image">
<style>${css}\n${preview ? 'a{pointer-events:none!important} .lc-tapall{display:none}' : ''}</style></head><body class="lc-theme-${mode === 'news' ? 'light' : 'dark'}">${body}${animation}${tracking}${preview && editorToken ? previewEditorHtml(mode, editorToken, { ...o, likeCount: d.likeCount, commentCount: d.commentCount, shareCount: d.shareCount }) : ''}</body></html>`;
}
