import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/surprise.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const rawInvite = 'https://lite.tiktok.com/t/ZS9AsxUWdSgEF-9javb/';
const expandedInvite = 'https://www.tiktok.com/ug/incentive/share/pro_scan_code?u_code=TEST&share_page_data=DATA';
const officialLaunch = 'https://app-va.tiktokv.com/lite_redirect/?redirect_url=snssdk473824%3A%2F%2Froma_redirect&short_dl=https%3A%2F%2Fsnssdk473824.onelink.me%2F4P4E&decode_once=1';

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

function linkGeneratorMock() {
  return {
    parseHttpUrl(raw) {
      try { return new URL(raw); } catch { return null; }
    },
    isTikTokLiteInviteShortLink(raw) {
      try {
        const u = new URL(raw);
        return u.protocol === 'https:' && u.hostname === 'lite.tiktok.com'
          && /^\/t\/[A-Za-z0-9_-]+\/?$/.test(u.pathname);
      } catch {
        return false;
      }
    },
    isInviteLpUrl(url) {
      return !!url && /(^|\.)tiktok\.com$/i.test(url.hostname)
        && /^\/ug\//i.test(url.pathname) && url.searchParams.has('u_code');
    },
    isOfficialTikTokLiteLaunchUrl(raw) {
      return raw === officialLaunch;
    },
    inviteLpFromOfficialTikTokLiteLaunchUrl(raw) {
      return raw === officialLaunch ? expandedInvite : null;
    },
  };
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
    if (name === '@/lib/link-generator') return linkGeneratorMock();
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

const rawConfig = load({
  identityResult: identityFailure,
  configResult: { data: { enabled: true, probability: 100, prize_url: rawInvite, prize_url_optimized: null }, error: null },
});
assert.equal(
  await rawConfig.resolveDestinationUrl(site, { deviceId: 'ordinary-visitor' }),
  rawInvite,
  'A raw short invite stays on TikTok official short-link -> invite-LP flow'
);

const expandedSite = { ...site, content_data: { tiktokUrl: expandedInvite } };
assert.equal(
  await rawConfig.resolveDestinationUrl(expandedSite, { deviceId: 'creator-device' }),
  expandedInvite,
  'An expanded official invite LP remains the public destination so TikTok can bind the referral'
);

const legacyLaunchSite = { ...site, content_data: { tiktokUrl: officialLaunch } };
assert.equal(
  await rawConfig.resolveDestinationUrl(legacyLaunchSite, { deviceId: 'creator-device' }),
  expandedInvite,
  'A legacy saved lite_redirect is migrated back to its embedded official invite LP'
);

assert.equal(
  await rawConfig.resolveDestinationUrl(site, { deviceId: 'creator-device' }),
  site.content_data.tiktokUrl,
  'Creator exclusion remains active for an ordinary non-TikTok destination'
);

console.log('Public destination safety: TikTok official short-link/LP flow is preserved; legacy lite_redirect migrates back to LP');
