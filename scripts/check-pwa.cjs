/* eslint-disable @typescript-eslint/no-require-imports -- Standalone check. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function main() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/manifest.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports });
  const manifest = exports.default();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    const png = fs.readFileSync(`public${icon.src}`);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  assert.match(fs.readFileSync('src/middleware.ts', 'utf8'), /worker-src 'self'/);
  const handlers = {};
  let offline = false, claimed = false, work;
  const live = new Response('Fresh page');
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    URL, Response, fetch: async () => { if (offline) throw new Error('Offline'); return live; },
    self: { addEventListener: (type, handler) => { handlers[type] = handler; }, location: { origin: 'https://bridge.test' }, clients: { claim: async () => { claimed = true; } } },
  });
  handlers.activate({ waitUntil: promise => { work = promise; } });
  await work;
  assert(claimed);
  const navigate = () => handlers.fetch({ request: { mode: 'navigate', url: 'https://bridge.test/' }, respondWith: promise => { work = promise; } });
  navigate();
  assert.equal(await work, live);
  offline = true;
  navigate();
  const fallback = await work;
  assert.equal(fallback.status, 503);
  assert.equal(fallback.headers.get('cache-control'), 'no-store');
  assert.match(await fallback.text(), /Current bridge conditions are unavailable/);
  for (const [mode, url] of [['cors', 'https://bridge.test/api/bridge-status'], ['navigate', 'https://bridge.test/api/weather'], ['navigate', 'https://other.test/']]) {
    handlers.fetch({ request: { mode, url }, respondWith: () => assert.fail('Must not intercept API or cross-origin requests') });
  }
  console.log('PWA checks passed: manifest/icons, activation, online/offline navigation, API bypass and worker CSP.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
