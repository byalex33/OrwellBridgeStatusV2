const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const datum = { status: 'CLOSED', details: 'HERE closure', description: 'HERE', averageSpeed: null };
async function main() {
  const traffic = load('src/lib/traffic.ts', { axios: { get: async () => { throw new Error('fixture outage'); } }, './here': { getHereTrafficData: async () => ({ eastbound: datum, westbound: datum }) } }, { TOMTOM_API_KEY: 'fixture', HERE_API_KEY: 'fixture' });
  const result = await traffic.getBridgeTrafficData();
  assert.equal(result.directions.eastbound.status, 'CLOSED');
  assert.equal(result.directions.eastbound.averageSpeed, null);
  const none = load('src/lib/traffic.ts');
  await assert.rejects(() => none.getBridgeTrafficData(), /All configured/);
  console.log('Independent provider checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
