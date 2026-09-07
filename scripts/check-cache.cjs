const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/cache.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports);
const { cache } = mod.exports;
(async () => {
  const realNow = Date.now; let now = 1000000, calls = 0;
  Date.now = () => now;
  try {
    const fetch = async () => ++calls;
    for (const expected of [1, 2]) {
      const results = await Promise.all(Array.from({ length: 20 }, () => cache.getOrFetch('key', fetch, 600, 300)));
      assert.ok(results.every(result => result === expected));
      assert.equal(calls, expected);
      now += 301000;
    }
    assert.equal(await cache.getOrFetch('null', async () => null), null);
    assert.equal(await cache.getOrFetch('null', () => { throw Error('must reuse null'); }), null);
    await assert.rejects(cache.getOrFetch('failure', () => { throw Error('offline'); }), /offline/);
    assert.equal(await cache.getOrFetch('failure', async () => 0), 0);
    assert.equal(await cache.getOrFetch('failure', () => { throw Error('must reuse zero'); }), 0);
  } finally { Date.now = realNow; cache.clear(); }
  console.log('Cold/stale concurrency and rejected-refresh recovery checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
