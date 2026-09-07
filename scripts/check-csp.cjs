// Run after npm run build. Starts an isolated production server.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
(async () => {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { stdio: 'ignore', windowsHide: true });
  try {
    const url = `http://127.0.0.1:${port}`;
    let response;
    for (let i = 0; i < 100; i++) {
      try { response = await fetch(url); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(response?.ok, 'production server must start');
    const nonces = new Set();
    for (const path of ['/', '/', '/missing.png', '/missing.svg', '/apiary', '/api/not-a-route']) {
      const result = await fetch(url + path, { headers: { 'x-nonce': 'attacker-value' } });
      assert.equal(result.status, path === '/' ? 200 : 404);
      assert.match(result.headers.get('content-type'), /text\/html/);
      assert.match(result.headers.get('cache-control'), /no-store|private/);
      const policy = result.headers.get('content-security-policy');
      const scripts = policy.split(';').find(value => value.trim().startsWith('script-src '));
      assert.ok(!scripts.includes('unsafe-inline') && !scripts.includes('unsafe-eval'));
      const nonce = scripts.match(/'nonce-([^']+)'/)[1];
      assert.ok(!nonces.has(nonce));
      assert.notEqual(nonce, 'attacker-value');
      nonces.add(nonce);
      const html = await result.text();
      const tags = [...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0]);
      assert.ok(tags.length > 1);
      for (const tag of tags) assert.ok(tag.includes(`nonce="${nonce}"`), path + ': ' + tag);
    }
    console.log('Production CSP: unique matching script nonces on pages and HTML 404s, no shared HTML caching or inline/eval bypass.');
  } finally { server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
