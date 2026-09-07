const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const observation = { timestamp: new Date(), directions: { eastbound: { status: 'OPEN', averageSpeed: 40 }, westbound: { status: 'OPEN', averageSpeed: 42 } }, overallStatus: { status: 'OPEN', details: 'Flowing' } };
let reads = 0;
const deferred = [];
const cache = new Map();
const collection = { insertOne: async () => ({ insertedId: '1' }), find: () => { reads++; throw Error('History must not be read for live traffic'); } };
const dependencies = {
  'next/server': { NextResponse: { json: body => body }, after: fn => deferred.push(fn) },
  '@/lib/traffic': { getBridgeTrafficData: async () => observation },
  '@/lib/cache': { cache: { getWithStale: key => ({ data: cache.get(key), isStale: false }), get: key => cache.get(key), set: (key, value) => cache.set(key, value), getOrFetch: async (key, fn) => { const value = cache.has(key) ? cache.get(key) : await fn(); cache.set(key, value); return value; } } },
  '@/lib/records': { mapBridgeRecord: x => x },
  '@/lib/mongodb': { default: () => Promise.resolve({ db: () => ({ collection: () => collection }) }) },
};
const mod = { exports: {} };
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/app/api/bridge-status/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, name => dependencies[name]);
(async () => {
  for (let i=0; i<2; i++) {
    const body = await mod.exports.GET();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.deepEqual(body.trafficData.directions, observation.directions);
    assert.equal(body.directions, undefined);
    assert.equal(body.overallStatus, undefined);
  }
  assert.equal(reads, 0);
  assert.equal(deferred.length, 1, 'history persistence runs after the response');
  console.log('Current payload checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
