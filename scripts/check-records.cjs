const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/records.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod.exports, require);
const { mapBridgeRecord } = mod.exports;
for (const timestamp of [new Date('2026-01-02T03:04:05Z'), '2026-01-02T03:04:05Z']) {
  const result = mapBridgeRecord({ status: 'DELAYS', timestamp });
  assert.equal(result.status, 'DELAYED');
  assert.equal(result.timestamp, '2026-01-02T03:04:05.000Z');
}
for (const timestamp of [undefined, '', 'bad', new Date(NaN)]) assert.equal(mapBridgeRecord({ timestamp }), null);
assert.equal(mapBridgeRecord({ timestamp: '2026-01-01', status: 'DELAYED' }).status, 'DELAYED');
console.log('Record normalization checks passed');
