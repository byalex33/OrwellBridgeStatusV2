const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const exportsForTest = {};
new Function('exports','require',ts.transpileModule(fs.readFileSync('src/lib/history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(exportsForTest,require);
const records = [];
const collection = {
  aggregate: () => { const last = records.at(-1); return { toArray: async () => last ? [last] : [] }; },
  insertOne: async record => { if(records.some(r => r._id === record._id)) throw Object.assign(Error('duplicate'),{code:11000}); records.push(record); },
};
const save = (eastbound,westbound,time) => exportsForTest.saveBridgeTransition(collection,{status:'CLOSED',timestamp:new Date(time).toISOString(),direction:'both',description:'Closure',averageSpeed:0},{eastbound:{status:eastbound},westbound:{status:westbound}});
(async () => {
  await save('CLOSED','OPEN',1000);
  await save('OPEN','CLOSED',2000);
  await Promise.all(Array.from({length:20},() => save('CLOSED','CLOSED',3000)));
  assert.equal(records.length,3);
  assert.deepEqual(records.map(r => [r.eastboundStatus,r.westboundStatus]),[['CLOSED','OPEN'],['OPEN','CLOSED'],['CLOSED','CLOSED']]);
  await save('OPEN','OPEN',1000);
  assert.equal(records.length,3,'older observations cannot add a misleading transition');
  await save('CLOSED','CLOSED',4000);
  assert.equal(records.length,3,'unchanged state does not create another event');
  collection.insertOne = async () => { throw Error('offline'); };
  await assert.rejects(save('OPEN','OPEN',5000),/offline/);
  console.log('Directional history and concurrent idempotency checks passed');
})().catch(error => { console.error(error); process.exitCode=1; });
