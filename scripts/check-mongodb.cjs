const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let attempts = 0, closes = 0;
class MongoClient {
  constructor(_uri, options) { for (const timeout of Object.values(options)) assert.equal(timeout, 2000); }
  async connect() { if (++attempts === 1) throw Error('offline'); return this; }
  async close() { closes++; }
}
const mod = { exports: {} };
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/mongodb.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, () => ({ MongoClient }));
(async () => {
  const old = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = 'mongodb://offline-test';
    await assert.rejects(mod.exports.default(), /offline/);
    const clients = await Promise.all(Array.from({ length: 20 }, () => mod.exports.default()));
    assert.equal(attempts, 2);
    assert.equal(closes, 1);
    assert.ok(clients.every(client => client === clients[0]));
  } finally { if (old === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = old; delete globalThis._mongoClientPromise; }
  console.log('MongoDB retry/deadline checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
