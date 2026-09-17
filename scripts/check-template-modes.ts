import { Script } from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderAlternateViewerHtml, type TemplateMode, type TemplateData } from '../lib/template-viewer.ts';
import { TEMPLATE_LAYOUTS } from '../lib/template-layouts.ts';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/link-card-layouts.json', import.meta.url), 'utf8'));
const modes: TemplateMode[] = ['news', 'instagram', 'instagram-live', 'live', 'x', 'youtube', 'file'];
const base: TemplateData = {
  templateMode: 'news', title: '<テスト>', tiktokUrl: 'https://lite.tiktok.com/t/test/?invite=a&code=b',
  slug: 'test', username: 'sample-user', description: '説明 & 本文', likeCount: '10', commentCount: '2', shareCount: '1',
  avatarUrl: 'https://example.com/avatar.jpg', backgroundUrl: 'https://example.com/background.jpg', ogpImageUrl: 'https://example.com/ogp.jpg', origin: 'https://example.test',
};
function bodyTags(html: string) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)![1].replace(/<script[^>]*>[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, '');
  return (body.match(/<[^>]+>/g) || []).map(tag => {
    const name = tag.match(/<\/?([\w-]+)/)![1];
    const cls = tag.match(/class="([^"]*)"/);
    return (tag.startsWith('</') ? '/' : '') + name + (cls ? '.' + cls[1] : '');
  });
}
for (const templateMode of modes) {
  const html = renderAlternateViewerHtml({ ...base, templateMode, templateSettings: { [templateMode]: {
    play: true, tapAll: false, badge: '速報', comments: 'コメントA\nコメントB', rows: [{ name: '画像.jpg', title: '関連動画' }],
  } } });
  assert.deepEqual(bodyTags(html), fixtures[templateMode].bodyTags, `${templateMode}: reference DOM structure`);
  const css = TEMPLATE_LAYOUTS[templateMode as keyof typeof TEMPLATE_LAYOUTS].css;
  assert.equal(createHash('sha256').update(css).digest('hex'), fixtures[templateMode].cssSha256, `${templateMode}: reference CSS`);
  assert.ok(html.includes('invite=a&amp;code=b'), 'invite query preserved');
  assert.ok(!html.includes('<テスト>') && !html.includes('説明 & 本文'), 'HTML escaped');
  assert.ok(!html.includes('{{') && !html.includes('LCREF_'), 'all placeholders filled');
  assert.ok(!html.includes('track.php') && !html.includes('example.com/preview') && !html.includes('link-card.online'), 'no reference service dependencies');
  const preview = renderAlternateViewerHtml({ ...base, templateMode }, { preview: true });
  assert.ok(!preview.includes('/api/visit') && !preview.includes('/fp.js'), 'preview does not record visits');
  assert.ok(preview.includes('pointer-events:none!important'), 'preview cannot navigate');
  const published = renderAlternateViewerHtml({ ...base, templateMode });
  assert.ok(published.includes('lc-go lc-tapall') && !published.includes('pointer-events:none!important'), 'public links enabled');
}
const custom = renderAlternateViewerHtml({ ...base, templateMode: 'file', templateSettings: { file: { rows: [
  { name: 'one.jpg', url: 'https://example.com/one?x=1&y=2' }, { name: 'two.jpg', url: 'javascript:alert(1)' },
], tapAll: false } } });
assert.equal((custom.match(/class="gf-row"/g) || []).length, 2);
assert.ok(custom.includes('Download 2 items as ZIP') && custom.includes('2 selected'));
assert.ok(custom.includes('https://example.com/one?x=1&amp;y=2') && !custom.includes('javascript:'));
const attacks = renderAlternateViewerHtml({ ...base, backgroundUrl: "https://example.com/a');color:red;/*", templateSettings: { news: { body: '</div><script>alert(1)</script>{{href}}' } } });
assert.ok(!attacks.includes('<script>alert(1)</script>') && !attacks.includes("a');color"));
assert.ok(attacks.includes('{{href}}'), 'user-authored placeholder text is not recursively expanded');
const live = renderAlternateViewerHtml({ ...base, templateMode: 'live', templateSettings: { live: { comments: '一件目\n二件目\n三件目', play: false, accent: '#00aaff' } } });
assert.equal((live.match(/class="lv-cm"/g) || []).length, 3);
assert.ok(live.includes('三件目') && !live.includes('<span class="lv-play"'));
assert.ok(live.includes('border:2px solid #00aaff'));
const video = renderAlternateViewerHtml({ ...base, templateMode: 'youtube', templateSettings: { youtube: { videoUrl: 'https://example.com/movie.mp4', loop: false, rows: [] } } });
assert.ok(video.includes('<video class="yt-v"') && !video.includes(' playsinline loop'));
console.log('7 reference layouts: CSS/DOM parity, editable content, invite links, preview isolation, and escaping passed');

for (const templateMode of modes) {
  const data = { ...base, templateMode, templateSettings: { [templateMode]: { heading: '', body: '</script><script>alert(1)</script>' } } };
  const editing = renderAlternateViewerHtml(data, { preview: true, editorToken: 'test-session' });
  const scripts = [...editing.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, `${templateMode}: isolated editor runtime only`);
  assert.doesNotThrow(() => new Script(scripts[0][1]), `${templateMode}: generated script parses`);
  assert.ok(editing.includes('test-session') && editing.includes('data-edit-text'));
  assert.ok(!editing.includes('/api/visit') && !editing.includes('function tick()'));
  const published = renderAlternateViewerHtml(data);
  assert.ok(!published.includes('template-editor') && !published.includes('data-edit-text'), 'editor never leaks to published pages');
}
const localImage = 'data:image/png;base64,iVBORw0KGgo=';
const localPreview = renderAlternateViewerHtml({ ...base, templateMode: 'instagram', backgroundUrl: localImage }, { preview: true, editorToken: 'local-image' });
assert.ok(localPreview.includes(localImage), 'sandboxed preview accepts a local image data URL');
assert.ok(!renderAlternateViewerHtml({ ...base, templateMode: 'instagram', backgroundUrl: localImage }).includes(localImage), 'published pages reject embedded data URLs');
console.log('Preview editor scripts: all modes parse, escaped input and public isolation passed');
