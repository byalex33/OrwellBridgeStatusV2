const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const east = [{ lat: 52.027, lng: 1.16 }, { lat: 52.027, lng: 1.17 }];
const flow = (points, jamFactor = 0) => ({ location: { shape: { links: [{ points }] } }, currentFlow: { speed: 10, confidence: 0.9, jamFactor } });
async function main() {
  const here = load('src/lib/here.ts', { axios: { get: async () => ({ data: { sourceUpdated: new Date().toISOString(), results: [flow(east, 10), flow([...east].reverse()), flow(east.map(p => ({...p, lat: 52.04})), 10)] } }) } });
  const result = await here.getHereTrafficData();
  assert.equal(result.eastbound.status, 'CLOSED');
  assert.equal(result.westbound.status, 'OPEN');
  assert.equal(here.analyzeHereFlow([flow(east, 9)]).status, 'DELAYED');
  assert.equal(here.analyzeHereFlow([{currentFlow: {}}]).status, 'UNKNOWN');
  assert.equal(here.analyzeHereFlow([flow(east, NaN)]).status, 'UNKNOWN');
  const ambiguous = flow(east, 10);
  ambiguous.location.shape.links.push({ points: [...east].reverse() });
  const mixed = load('src/lib/here.ts', { axios: { get: async () => ({ data: { sourceUpdated: new Date().toISOString(), results: [ambiguous] } }) } });
  const excluded = await mixed.getHereTrafficData();
  assert.equal(excluded.eastbound.status, 'UNKNOWN');
  assert.equal(excluded.westbound.status, 'UNKNOWN');
  console.log('HERE directional checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
assert.equal(load('src/lib/here.ts').analyzeHereFlow([null]).status, 'UNKNOWN');
assert.equal(load('src/lib/bridge.ts').crossingDirection([null, {}]), null);

