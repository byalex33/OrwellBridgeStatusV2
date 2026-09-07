const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exportsForTest = {};
new Function('exports','require',ts.transpileModule(fs.readFileSync('src/lib/history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(exportsForTest,require);
const records = [];
let queue = Promise.resolve(), failWrite = false, transactions = 0;
const lock = { updateOne: async (_filter, update, options) => {
  if (update.$setOnInsert) return;
  const session = options.session;
  const previous = queue;
  queue = new Promise(resolve => { session.release = resolve; });
  await previous;
  session.locked = true;
} };
const collection = {
  aggregate: (_pipeline, { session }) => { assert.ok(session.locked, 'lock must precede latest-state read'); return { toArray: async () => records.slice(-1) }; },
  insertOne: async (record, { session }) => { assert.ok(session.locked); if (failWrite) throw Error('offline'); records.push(record); },
};
const client = {
  db: () => ({ collection: name => name === 'bridgeevents' ? collection : lock }),
  withSession: async fn => {
    const session = { withTransaction: async (body, options) => {
      assert.equal(options.timeoutMS, 2000); transactions++;
      try { return await body(); } finally { session.release?.(); }
    } };
    return fn(session);
  },
};
const save = (eastbound,westbound,time) => exportsForTest.saveBridgeTransition(client,{status:'CLOSED',timestamp:new Date(time).toISOString(),direction:'both',description:'Closure',averageSpeed:0,speedUnit:'mph'},{eastbound:{status:eastbound},westbound:{status:westbound}});
(async () => {
  await save('CLOSED','OPEN',1000);
  await save('OPEN','CLOSED',2000);
  await Promise.all(Array.from({length:20},() => save('CLOSED','CLOSED',3000)));
  assert.equal(records.length,3);
  assert.ok(records.every(record => record.speedUnit === 'mph'));
  assert.deepEqual(records.map(r => [r.eastboundStatus,r.westboundStatus]),[['CLOSED','OPEN'],['OPEN','CLOSED'],['CLOSED','CLOSED']]);
  await Promise.all([save('OPEN','OPEN',6000), save('CLOSED','OPEN',5000)]);
  assert.equal(records.length,4,'older competing observation must not commit after newer');
  assert.equal(records.at(-1).timestamp.getTime(),6000);
  failWrite = true;
  await assert.rejects(save('CLOSED','OPEN',7000),/offline/);
  assert.equal(records.length,4,'failed transition must not create partial history');
  failWrite = false;
  await save('CLOSED','OPEN',7000);
  assert.equal(records.length,5,'retry after write failure must persist the transition');
  assert.equal(transactions,26);
  console.log('Transactional directional-history ordering/idempotency checks passed');
})().catch(error => { console.error(error); process.exitCode=1; });
