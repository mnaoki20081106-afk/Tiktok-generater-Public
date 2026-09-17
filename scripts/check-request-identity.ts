import assert from 'node:assert/strict';
import {
  clientIpFromHeaders,
  hashClientIp,
  isIpHashingConfigured,
  normalizeClientIp,
} from '../lib/request-identity.ts';

const previousSecret = process.env.IP_HASH_SECRET;
try {
  process.env.IP_HASH_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  assert.equal(isIpHashingConfigured(), true);
  assert.equal(normalizeClientIp('203.0.113.10:443'), 'ipv4:203.0.113.10');
  assert.equal(normalizeClientIp('::ffff:203.0.113.10'), 'ipv4:203.0.113.10');
  assert.equal(
    normalizeClientIp('[2001:0db8:abcd:0012:1111:2222:3333:4444]:443'),
    'ipv6-64:2001:0db8:abcd:0012'
  );
  assert.equal(
    normalizeClientIp('2001:db8:abcd:12:ffff:eeee:dddd:cccc'),
    'ipv6-64:2001:0db8:abcd:0012'
  );
  assert.equal(normalizeClientIp('not-an-ip'), null);

  const forwarded = new Headers({ 'x-forwarded-for': '198.51.100.3, 203.0.113.9' });
  assert.equal(clientIpFromHeaders(forwarded), 'ipv4:203.0.113.9', 'closest proxy value is used');
  const direct = new Headers({
    'cf-connecting-ip': '198.51.100.8',
    'x-forwarded-for': '203.0.113.9',
  });
  assert.equal(clientIpFromHeaders(direct), 'ipv4:198.51.100.8', 'trusted direct header wins');

  const first = hashClientIp(new Headers({ 'x-real-ip': '2001:db8:abcd:12::1' }));
  const sameNetwork = hashClientIp(new Headers({ 'x-real-ip': '2001:db8:abcd:12::ffff' }));
  const otherNetwork = hashClientIp(new Headers({ 'x-real-ip': '2001:db8:abcd:13::1' }));
  assert.ok(first?.startsWith('v1:'));
  assert.equal(first, sameNetwork, 'IPv6 privacy address changes stay in the same /64 identity');
  assert.notEqual(first, otherNetwork);

  delete process.env.IP_HASH_SECRET;
  assert.equal(isIpHashingConfigured(), false);
  assert.equal(hashClientIp(new Headers({ 'x-real-ip': '203.0.113.10' })), null, 'never store an unkeyed IP hash');
} finally {
  if (previousSecret === undefined) delete process.env.IP_HASH_SECRET;
  else process.env.IP_HASH_SECRET = previousSecret;
}

console.log('Creator IP identity: normalized, HMAC-protected, IPv6 /64-stable, and disabled without a secret');
