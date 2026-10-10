const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const datum = { status: 'CLOSED', details: 'Mapbox closure', description: 'Mapbox', averageSpeed: null };
async function main() {
  const traffic = load('src/lib/traffic.ts', { './national-highways': { getNationalHighwaysData: async () => { throw new Error('fixture outage'); } }, './mapbox': { getMapboxTrafficData: async () => ({ eastbound: datum, westbound: datum }) } }, { NATIONAL_HIGHWAYS_API_KEY: 'fixture', MAPBOX_ACCESS_TOKEN: 'fixture' });
  const result = await traffic.getBridgeTrafficData();
  assert.equal(result.directions.eastbound.status, 'CLOSED');
  assert.equal(result.directions.eastbound.averageSpeed, null);
  const none = load('src/lib/traffic.ts');
  await assert.rejects(() => none.getBridgeTrafficData(), /All configured/);
  console.log('Independent provider checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
