import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const source = readFileSync(new URL('../lib/supabase/middleware.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function request(path, { user = { id: 'user-1', email: 'member@example.com' }, method = 'GET' } = {}) {
  const loaded = { exports: {} };
  const mockRequire = (name) => {
    if (name === '@/lib/device') return { DEVICE_COOKIE: 'dvid', DEVICE_COOKIE_MAX_AGE: 31536000 };
    if (name === '@/lib/admin') return { isAdminEmail: (email) => email === 'admin@example.com' };
    if (name === '@supabase/ssr') return {
      createServerClient: (_url, _key, { cookies }) => ({
        auth: { getUser: async () => {
          // Simulate a refresh with multiple writes, including an old chunk deletion.
          cookies.setAll([{ name: 'session.1', value: '', options: { path: '/', maxAge: 0 } }]);
          cookies.setAll([{ name: 'session.0', value: user ? 'refreshed' : '', options: { path: '/', maxAge: user ? 34560000 : 0, sameSite: 'lax' } }]);
          return { data: { user } };
        } },
        from: () => ({ upsert: async () => ({ error: null }) }),
      }),
    };
    return require(name);
  };
  vm.runInNewContext(compiled, { exports: loaded.exports, require: mockRequire, process });
  const response = await loaded.exports.updateSession(new NextRequest(`https://example.com${path}`, { method }));
  assert.equal(response.cookies.get('session.0')?.value, user ? 'refreshed' : '');
  assert.equal(response.cookies.get('session.0')?.maxAge, user ? 34560000 : 0);
  assert.equal(response.cookies.get('session.1')?.maxAge, 0);
  assert.ok(response.cookies.get('dvid')?.value);
  return response;
}

for (const path of ['/', '/login', '/login?error=old', '/admin']) {
  const response = await request(path);
  assert.equal(response.headers.get('location'), 'https://example.com/dashboard');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
}
for (const path of ['/dashboard', '/admin']) {
  assert.equal((await request(path, { user: null })).headers.get('location'), 'https://example.com/login');
}
for (const path of ['/', '/login']) {
  assert.equal((await request(path, { user: null })).status, 200);
  assert.equal((await request(path, { method: 'POST' })).status, 200);
}
assert.equal((await request('/dashboard')).status, 200);
assert.equal((await request('/p/public-page')).status, 200);
assert.equal((await request('/login', { method: 'HEAD' })).status, 307);
assert.equal((await request('/admin', { user: { id: 'admin-1', email: 'admin@example.com' } })).status, 200);
console.log('Session routing and refreshed/deleted cookie retention: passed');
