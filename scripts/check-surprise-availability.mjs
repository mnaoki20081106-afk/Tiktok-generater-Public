import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/surprise.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const site = {
  id: 'site-1',
  user_id: 'owner-1',
  creator_device_id: 'creator-device',
  creator_fingerprint: 'creator-fingerprint',
  content_data: { tiktokUrl: 'https://example.com/real' },
};

function query(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result,
  };
  return builder;
}

function load({ identityResult, configResult }) {
  const loaded = { exports: {} };
  const admin = {
    from(table) {
      if (table === 'surprise_config') return query(configResult);
      return query(identityResult);
    },
  };
  const mockRequire = name => {
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => admin };
    throw new Error(`Unexpected import: ${name}`);
  };
  vm.runInNewContext(compiled, { exports: loaded.exports, require: mockRequire, Math });
  return loaded.exports;
}

const enabled = { data: { enabled: true, probability: 100, prize_url_optimized: 'https://example.com/prize' }, error: null };
const identityFailure = { data: null, error: { message: 'temporary identity lookup failure' } };
const failOpen = load({ identityResult: identityFailure, configResult: enabled });
assert.equal(
  await failOpen.resolveDestinationUrl(site, { deviceId: 'ordinary-visitor' }),
  'https://example.com/prize',
  'identity lookup failure must not disable the draw for ordinary visitors'
);
assert.equal(
  await failOpen.resolveDestinationUrl(site, { deviceId: 'creator-device' }),
  'https://example.com/real',
  'the existing creator cookie still excludes the owner during an identity DB failure'
);

const configFailure = load({ identityResult: { data: null, error: null }, configResult: { data: null, error: { message: 'config unavailable' } } });
assert.equal(
  await configFailure.resolveDestinationUrl(site, { deviceId: 'ordinary-visitor' }),
  'https://example.com/real',
  'without draw configuration there is no safe prize URL to return'
);

const rawInvite = 'https://lite.tiktok.com/t/ZS9SKLkjB9v5P-nhiPj/';
const rawConfig = load({
  identityResult: identityFailure,
  configResult: { data: { enabled: true, probability: 100, prize_url: rawInvite, prize_url_optimized: null }, error: null },
});
assert.equal(await rawConfig.resolveDestinationUrl(site, { deviceId: 'ordinary-visitor' }), rawInvite,
  'Missing resolved URL must not stop the draw or change the invitation token');
assert.equal(await rawConfig.resolveDestinationUrl(site, { deviceId: 'creator-device' }), site.content_data.tiktokUrl,
  'Creator exclusion remains active with an unresolved prize URL');

console.log('Surprise draw availability: identity lookup failures do not stop draws; creator cookie exclusion remains active');
