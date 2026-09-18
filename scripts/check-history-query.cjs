const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const now = Date.now() - 7 * 24 * 60 * 60 * 1000;
const fixtures = Array.from({ length: 8 }, (_, i) => ({ _id: String(i), status: 'DELAYS', timestamp: i % 2 ? new Date(now - i * 3600000) : new Date(now - i * 3600000).toISOString() }));
fixtures.push(
  { _id: 'open', status: 'OPEN', timestamp: new Date() },
  { _id: 'unknown', status: 'UNKNOWN', timestamp: new Date() },
  { _id: 'invalid', status: 'CLOSED', timestamp: 'invalid' },
  { _id: 'missing', status: 'CLOSED' },
);
fixtures[1].status = 'CLOSED';
fixtures[2].status = 'DELAYED';
const collection = { aggregate: pipeline => {
  let records = fixtures.slice().reverse();
  for (const stage of pipeline) {
    if (stage.$match?.status?.$in) records = records.filter(r => stage.$match.status.$in.includes(r.status));
    if (stage.$set) records = records.map(r => ({ ...r, timestamp: r.timestamp != null && Number.isFinite(new Date(r.timestamp).getTime()) ? new Date(r.timestamp) : null }));
    if (stage.$match?.timestamp?.$gte) records = records.filter(r => r.timestamp >= stage.$match.timestamp.$gte);
    if (stage.$match?.timestamp?.$ne === null) records = records.filter(r => r.timestamp !== null);
    if (stage.$sort) records.sort((a,b) => b.timestamp - a.timestamp);
    if (stage.$limit) records = records.slice(0, stage.$limit);
  }
  return { async *[Symbol.asyncIterator]() { yield* records; }, close: async () => {} };
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
route.GET().then(async records => {
  assert.deepEqual(records.map(r => r._id), ['0','1','2','3','4'], 'past incidents remain visible after 24 hours, newest first');
  assert.deepEqual(records.map(r => r.status), ['DELAYED', 'CLOSED', 'DELAYED', 'DELAYED', 'DELAYED']);
  fixtures.length = 0;
  fixtures.push(
    { _id: 'latest', status: 'CLOSED', direction: 'eastbound', timestamp: new Date(now) },
    ...Array.from({ length: 100 }, (_, i) => ({ _id: `duplicate-${i}`, status: 'CLOSED', direction: 'eastbound', averageSpeed: i, timestamp: new Date(now - (i + 1) * 1000) })),
    { _id: 'other-direction', status: 'CLOSED', direction: 'westbound', timestamp: new Date(now - 120000) },
    { _id: 'other-status', status: 'DELAYED', direction: 'eastbound', timestamp: new Date(now - 180000) },
    { _id: 'within-window', status: 'CLOSED', direction: 'eastbound', timestamp: new Date(now - 29 * 60000) },
    { _id: 'at-boundary', status: 'CLOSED', direction: 'eastbound', timestamp: new Date(now - 30 * 60000) },
    { _id: 'older', status: 'CLOSED', direction: 'eastbound', timestamp: new Date(now - 60 * 60000) },
  );
  assert.deepEqual((await route.GET()).map(r => r._id), ['latest', 'other-direction', 'other-status', 'at-boundary', 'older'], 'deduplicate before limiting, preserving different statuses/directions and the 30-minute boundary');
  fixtures.length = 0;
  assert.deepEqual(await route.GET(), [], 'empty history is a successful array response');
  console.log('Older incidents, mixed date/string ordering, invalid timestamps and empty-result checks passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
