// Run after npm run build. Starts an isolated production server.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
(async () => {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '0'], { stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true, env: { ...process.env, TOMTOM_API_KEY: '', HERE_API_KEY: '', NATIONAL_HIGHWAYS_API_KEY: '', MONGODB_URI: '', HTTP_PROXY: 'http://127.0.0.1:1', HTTPS_PROXY: 'http://127.0.0.1:1', NO_PROXY: '127.0.0.1,localhost' } });
  let startupTimer;
  try {
    const url = await new Promise((resolve, reject) => {
      let output = '';
      startupTimer = setTimeout(() => reject(Error('Production server did not report its port')), 10000);
      server.once('error', reject);
      server.once('exit', code => reject(Error('Production server exited: ' + code)));
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) { clearTimeout(startupTimer); resolve(match[0]); }
      });
    });
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
    for (const path of ['/api/bridge-status', '/api/events', '/api/weather']) {
      const result = await fetch(url + path, { signal: AbortSignal.timeout(15000) });
      assert.ok([200, 503].includes(result.status), path + ' must return its availability contract');
      assert.match(result.headers.get('content-type'), /application\/json/);
      assert.match(result.headers.get('cache-control'), /no-store/);
      const body = await result.json();
      if (path === '/api/weather') { assert.equal(result.status, 503); assert.equal(body.data, null); }
      if (path === '/api/events') assert.equal(result.status, 503);
      if (path === '/api/bridge-status' && body.success) {
        assert.equal(body.trafficData.directions.eastbound.status, 'UNKNOWN');
        assert.equal(body.trafficData.directions.westbound.status, 'UNKNOWN');
      }
    }
    console.log('Production API routes: offline availability contracts and no-store headers passed.');
    console.log('Production CSP: unique matching script nonces on pages and HTML 404s, no shared HTML caching or inline/eval bypass.');
  } finally { clearTimeout(startupTimer); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
