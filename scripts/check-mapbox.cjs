const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const east = [[1.158, 52.027], [1.172, 52.027]];
const route = (overrides = {}, coordinates = east, congestion = ['low']) => ({
  distance: 970, duration: 60, duration_typical: 55,
  geometry: { coordinates },
  legs: [{ annotation: { distance: [970], congestion } }],
  ...overrides,
});
async function main() {
  const mapbox = load('src/lib/mapbox.ts');
  const analyze = (r, direction = 'eastbound') => mapbox.analyzeMapboxRoute(r, direction);
  assert.equal(analyze(route()).status, 'OPEN');
  assert.equal(analyze(route()).averageSpeed, 36);
  assert.equal(analyze(route({}, east, ['heavy'])).status, 'DELAYED');
  assert.equal(analyze(route({ duration: 200 })).status, 'DELAYED');
  assert.equal(analyze(route({ legs: [{ closures: [{ geometry_index_start: 0, geometry_index_end: 1 }] }] })).status, 'CLOSED');
  assert.equal(analyze(route({ legs: [{ incidents: [{ closed: true }], annotation: { distance: [970], congestion: ['low'] } }] })).status, 'CLOSED');
  assert.equal(analyze(route({ legs: [{ incidents: [{ closed: false }], annotation: { distance: [970], congestion: ['low'] } }] })).status, 'OPEN');
  assert.equal(analyze(route(), 'westbound').status, 'UNKNOWN', 'a route crossing the other way is not evidence');
  assert.equal(analyze(route({}, [[1.158, 52.04], [1.172, 52.04]])).status, 'UNKNOWN', 'a route off the bridge is not evidence');
  assert.equal(analyze(route({ distance: 9000 })).status, 'UNKNOWN', 'a detour is not treated as a closure');
  assert.equal(analyze(route({}, east, ['unknown'])).status, 'UNKNOWN', 'typical-speed estimates are not live evidence');
  assert.equal(analyze(undefined).status, 'UNKNOWN');
  assert.equal(analyze(route({ geometry: { coordinates: [null, 'x'] } })).status, 'UNKNOWN');

  const requests = [];
  const live = load('src/lib/mapbox.ts', { axios: { get: async (url, options) => {
    requests.push({ url, options });
    if (url.includes('1.172455')) throw new Error('westbound outage');
    return { data: { code: 'Ok', routes: [route()] } };
  } } }, { MAPBOX_ACCESS_TOKEN: 'fixture' });
  const result = await live.getMapboxTrafficData();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.params.access_token, 'fixture');
  assert.match(requests[0].options.params.annotations, /closure/);
  assert.equal(result.eastbound.status, 'OPEN');
  assert.match(result.eastbound.description, /Mapbox/);
  assert.equal(result.westbound.status, 'UNKNOWN');
  const down = load('src/lib/mapbox.ts', { axios: { get: async () => ({ data: { code: 'NoRoute' } }) } });
  await assert.rejects(() => down.getMapboxTrafficData(), /unavailable/);
  console.log('Mapbox directional checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
