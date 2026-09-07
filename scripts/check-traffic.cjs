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
  let requests = 0;
  const traffic = load('src/lib/traffic.ts', { axios: { get: async (_url, options) => {
    requests++;
    assert.equal(options.params.unit, 'MPH');
    return { data: { flowSegmentData: { currentSpeed: 62, freeFlowSpeed: 70, roadClosure: false } } };
  } } }, { TOMTOM_API_KEY: 'fixture' });
  const result = await traffic.getBridgeTrafficData();
  assert.equal(requests, 2);
  assert.equal(result.directions.eastbound.averageSpeed, 62);
  console.log('Traffic regression checks passed');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { load };
