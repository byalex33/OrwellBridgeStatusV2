// Run after npm run build. Starts an isolated production server with no provider keys.
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
    const policy = response.headers.get('content-security-policy');
    const scripts = policy.split(';').find(value => value.trim().startsWith('script-src '));
    assert.ok(!scripts.includes('unsafe-inline') && !scripts.includes('unsafe-eval'));
    const nonce = scripts.match(/'nonce-([^']+)'/)[1];
    const html = await response.text();
    const tags = [...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0]);
    assert.ok(tags.length > 1);
    for (const tag of tags) assert.ok(tag.includes(`nonce="${nonce}"`), tag);
    const second = await fetch(url, { headers: { 'x-nonce': 'attacker-value' } });
    const nextPolicy = second.headers.get('content-security-policy');
    assert.ok(second.ok);
    const nextNonce = nextPolicy.match(/'nonce-([^']+)'/)[1];
    const nextHtml = await second.text();
    const nextTags = [...nextHtml.matchAll(/<script\b[^>]*>/g)].map(match => match[0]);
    assert.ok(nextTags.length > 1);
    for (const tag of nextTags) assert.ok(tag.includes('nonce="' + nextNonce + '"'), tag);
    assert.notEqual(nextNonce, nonce);
    assert.notEqual(nextNonce, 'attacker-value');
    console.log('Production CSP: every script nonced, unique per request, no inline/eval bypass.');
  } finally { server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
