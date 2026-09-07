const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, dependencies = {}) {
  const exports = {};
  new Function('exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(exports, name => dependencies[name]);
  return exports;
}
const { cache } = load('src/lib/cache.ts');
const realNow = Date.now; let now = 1000000;
Date.now = () => now;
const timestamp = new Date(now);
cache.set('bridge-status', { records: [{ timestamp: timestamp.toISOString() }], timestamp, trafficData: { directions: {}, overallStatus: {} } }, 600, 300);
now += 599000;
const route = load('src/app/api/bridge-status/route.ts', {
  'next/server': { NextResponse: { json: body => body } },
  '@/lib/cache': { cache },
  '@/lib/records': {},
  '@/lib/traffic': { getBridgeTrafficData: async () => { now += 2000; throw Error('offline'); } },
});
route.GET().then(body => {
  assert.equal(body.success,true);
  assert.equal(body.stale,true);
  assert.equal(body.fallback,true);
  assert.equal(body.timestamp,timestamp);
  assert.equal(cache.get('bridge-status'),null,'fallback must not renew expired cache');
  console.log('Refresh crossing cache expiry retains explicitly stale response');
}).catch(error => { console.error(error); process.exitCode=1; }).finally(() => { Date.now=realNow; });
