const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, env = {}, expose = []) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8') + expose.map(name => `\nexports.${name} = ${name};`).join('');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, process: { env }, console, Date, URL, AbortSignal,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name.startsWith('.')) return load(path.join(path.dirname(file), name) + '.ts', mocks, env);
      return require(name);
    } }, { filename: file });
  return exports;
}
async function main() {
  const reading = (status, description, averageSpeed = null) => ({ status, details: status, description, averageSpeed });
  let mapboxCalls = 0;
  const traffic = load('src/lib/traffic.ts', {
    './mapbox': { getMapboxTrafficData: async () => { mapboxCalls++; return { eastbound: reading('OPEN', 'A14 eastbound (Mapbox)', 62), westbound: reading('OPEN', 'A14 westbound (Mapbox)', 58) }; } },
    './national-highways': { getNationalHighwaysData: async () => ({ eastbound: reading('UNKNOWN', 'National Highways'), westbound: reading('CLOSED', 'National Highways') }) },
  }, { MAPBOX_ACCESS_TOKEN: 'fixture', NATIONAL_HIGHWAYS_API_KEY: 'fixture' });
  const result = await traffic.getBridgeTrafficData();
  assert.equal(mapboxCalls, 1);
  assert.equal(result.directions.eastbound.status, 'OPEN');
  assert.equal(result.directions.eastbound.averageSpeed, 62);
  assert.match(result.directions.eastbound.description, /Mapbox/);
  assert.equal(result.directions.westbound.status, 'CLOSED', 'an official closure outranks a flowing estimate');
  assert.equal(result.overallStatus.status, 'CLOSED');
  console.log('Traffic regression checks passed');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { load };


