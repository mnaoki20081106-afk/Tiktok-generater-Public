import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard = fs.readFileSync(
  new URL('../app/dashboard/page.tsx', import.meta.url),
  'utf8',
);
const admin = fs.readFileSync(
  new URL('../app/admin/page.tsx', import.meta.url),
  'utf8',
);
const actions = fs.readFileSync(
  new URL('../app/admin/x-keyword-actions.ts', import.meta.url),
  'utf8',
);

assert.match(dashboard, />\s*管理画面\s*</, 'admin entry must be named 管理画面');
assert.doesNotMatch(
  dashboard,
  />\s*抽選設定\s*</,
  'dashboard must no longer label the admin entry as 抽選設定',
);

assert.match(admin, /管理画面/);
assert.match(admin, /<XKeywordSettings/);
assert.match(admin, /getXKeywordConfig\(\)/);
assert.match(admin, /isXKeywordWriteConfigured\(\)/);

assert.match(actions, /await assertAdmin\(\)/);
assert.match(actions, /await updateXKeywords\(/);
assert.match(actions, /revalidatePath\('\/admin'\)/);
assert.doesNotMatch(
  actions,
  /item\.startsWith\('#'\)/,
  'hashtag keywords such as #PR must remain valid',
);

console.log('✅ Admin console and X keyword management checks passed');
