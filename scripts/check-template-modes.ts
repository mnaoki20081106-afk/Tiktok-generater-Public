import { renderAlternateViewerHtml, type TemplateMode } from '../lib/template-viewer.ts';

const modes: TemplateMode[] = ['news', 'instagram', 'instagram-live', 'live', 'x', 'youtube', 'file'];

for (const templateMode of modes) {
  const html = renderAlternateViewerHtml({
    templateMode,
    title: '<テスト>',
    tiktokUrl: 'https://example.com/destination',
    slug: 'test',
    username: 'sample-user',
    description: '説明 & 本文',
    likeCount: '10',
    commentCount: '2',
    shareCount: '1',
    avatarUrl: 'https://example.com/avatar.jpg',
    backgroundUrl: 'https://example.com/background.jpg',
    ogpImageUrl: 'https://example.com/ogp.jpg',
    origin: 'https://example.test',
  });

  if (!html.includes(`class="screen ${templateMode}"`)) throw new Error(`${templateMode}: mode class is missing`);
  if (!html.includes('class="tap"')) throw new Error(`${templateMode}: destination link is missing`);
  if (!html.includes('https://example.com/destination')) throw new Error(`${templateMode}: destination URL is missing`);
  if (html.includes('<テスト>') || html.includes('説明 & 本文')) throw new Error(`${templateMode}: text is not escaped`);
}

console.log(`追加テンプレート ${modes.length} モードのHTML生成テストに合格しました。`);
