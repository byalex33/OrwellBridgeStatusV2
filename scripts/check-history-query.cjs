const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const now = Date.now();
const fixtures = Array.from({ length: 8 }, (_, i) => ({ _id: String(i), status: 'DELAYS', timestamp: i % 2 ? new Date(now - i * 1000) : new Date(now - i * 1000).toISOString() }));
const collection = { aggregate: pipeline => {
  let records = fixtures.slice().reverse();
  for (const stage of pipeline) {
    if (stage.$set) records = records.map(r => ({ ...r, timestamp: new Date(r.timestamp) }));
    if (stage.$match?.timestamp?.$gte) records = records.filter(r => r.timestamp >= stage.$match.timestamp.$gte);
    if (stage.$sort) records.sort((a,b) => b.timestamp - a.timestamp);
    if (stage.$limit) records = records.slice(0, stage.$limit);
  }
  return { toArray: async () => records };
} };
function load(path, dependencies = {}) {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports, name => dependencies[name]);
  return exports;
}
const route = load('src/app/api/events/route.ts', {
  'next/server': { NextResponse: { json: body => body } },
  '@/lib/records': load('src/lib/records.ts'),
  '@/lib/cache': { cache: { get: () => null, set: () => {}, getOrFetch: (_key, fn) => fn() } },
  '@/lib/mongodb': { default: () => Promise.resolve({ db: () => ({ collection: () => collection }) }) },
});
route.GET().then(records => {
  assert.deepEqual(records.map(r => r._id), ['0','1','2','3','4']);
  assert.ok(records.every(r => r.status === 'DELAYED'));
  console.log('Mixed date/string history ordering check passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
