import assert from 'node:assert/strict';
import {
  applyXKeywordChanges,
  parseXKeywordValues,
} from '../lib/x-monitor-keywords.ts';

const ng = `# comment
#PR
抽選で
フォロー&RT, アマギフ
`;

assert.deepEqual(
  parseXKeywordValues('ng', ng),
  ['#PR', '抽選で', 'フォロー&RT', 'アマギフ'],
  'hashtag keywords must not be mistaken for comments',
);

const changed = applyXKeywordChanges(
  'ng',
  ng,
  ['新規ワード', '#PR'],
  ['抽選で', 'アマギフ'],
);

assert.match(changed, /^# comment/m);
assert.match(changed, /^#PR$/m);
assert.doesNotMatch(changed, /^抽選で$/m);
assert.doesNotMatch(changed, /アマギフ/);
assert.match(changed, /フォロー&RT/);
assert.match(changed, /新規ワード/);
assert.equal((changed.match(/^#PR$/gm) || []).length, 1, 'duplicate additions are suppressed');

const combo = `# combo
(A OR B) C
(D OR E) F
`;
const comboChanged = applyXKeywordChanges(
  'combo',
  combo,
  ['(G OR H) I'],
  ['(A OR B) C'],
);
assert.deepEqual(
  parseXKeywordValues('combo', comboChanged),
  ['(D OR E) F', '(G OR H) I'],
);

console.log('✅ X monitor keyword add/remove compatibility passed');
