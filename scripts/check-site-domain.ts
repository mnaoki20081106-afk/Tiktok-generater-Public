import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PRODUCTION_SITE_ORIGIN } from '../lib/site-url.ts';

assert.equal(PRODUCTION_SITE_ORIGIN, 'https://post-link.net');

const files = [
  'app/layout.tsx',
  'app/[slug]/route.ts',
  'lib/site-url.ts',
  '.env.local.example',
  'README.md',
];

for (const file of files) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /social-tiktok\.com/i,
    `${file} must not reference the retired social-tiktok.com domain`,
  );
}

const envExample = fs.readFileSync(
  new URL('../.env.local.example', import.meta.url),
  'utf8',
);
assert.match(envExample, /NEXT_PUBLIC_SITE_URL=https:\/\/post-link\.net/);

const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
assert.match(layout, /resolveMetadataBase/);

const publicRoute = fs.readFileSync(
  new URL('../app/[slug]/route.ts', import.meta.url),
  'utf8',
);
assert.match(publicRoute, /resolvePublicSiteOrigin\(request\.url\)/);

console.log('✅ post-link.net canonical domain checks passed');
