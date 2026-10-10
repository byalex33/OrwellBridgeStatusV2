const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let stored = null, fetches = 0, mongoDown = false;
const collection = {
  findOne: async () => { if (mongoDown) throw Error('offline'); return stored; },
  updateOne: async (_query, update) => { if (mongoDown) throw Error('offline'); stored = { ...update.$set }; },
};
const dependencies = {
  './mongodb': { default: async () => ({ db: () => ({ collection: () => collection }) }) },
  './traffic': { getBridgeTrafficData: async () => { fetches++; return { directions: {}, overallStatus: {}, timestamp: new Date() }; } },
};
const mod = { exports: {} };
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/reading.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, name => dependencies[name]);
const reading = mod.exports;
const realError = console.error;
console.error = () => {};
(async () => {
  await reading.getSharedTrafficReading();
  assert.equal(fetches, 1, 'empty store fetches providers once');
  for (let i = 0; i < 5; i++) await reading.getSharedTrafficReading();
  assert.equal(fetches, 1, 'fresh stored reading is served without provider calls');
  stored.timestamp = new Date(Date.now() - reading.READING_MAX_AGE_MS - 1000);
  await reading.getSharedTrafficReading();
  assert.equal(fetches, 2, 'expired stored reading refreshes providers');
  mongoDown = true;
  for (let i = 0; i < 5; i++) await reading.getSharedTrafficReading();
  assert.equal(fetches, 2, 'database outage reuses the in-process reading');
  await reading.refreshTrafficReading();
  assert.equal(fetches, 3, 'scheduled refresh always fetches, even if saving fails');
  console.log('Shared traffic reading cache checks passed');
})().catch(error => { realError(error); process.exitCode = 1; }).finally(() => { console.error = realError; });
