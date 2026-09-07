const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const { consensusDirection } = load('src/lib/consensus.ts');
const datum = status => ({ status, details: status, description: 'fixture', averageSpeed: 40 });
for (const a of ['OPEN', 'DELAYED', 'CLOSED', 'UNKNOWN']) for (const b of ['OPEN', 'DELAYED', 'CLOSED', 'UNKNOWN']) {
  const result = consensusDirection(datum(a), datum(b), datum('CLOSED'));
  assert.equal(result.status, 'CLOSED');
  if ([a,b].some(s => ['OPEN','DELAYED'].includes(s))) assert.match(result.details, /Sources disagree/);
}
assert.equal(consensusDirection(null, datum('UNKNOWN')).status, 'UNKNOWN');
assert.equal(consensusDirection(datum('OPEN'), datum('DELAYED')).status, 'DELAYED');
console.log('Closure consensus checks passed');
