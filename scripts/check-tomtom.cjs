const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
async function main() {
  const realWarn = console.warn; console.warn = () => {};
  const { analyzeTomTomSegment: analyze } = load('src/lib/tomtom.ts');
  for (const speed of [undefined, null, NaN, Infinity, -1]) {
    assert.equal(analyze({ flowSegmentData: { currentSpeed: speed, freeFlowSpeed: 70 } }).status, 'UNKNOWN');
  }
  assert.equal(analyze({ flowSegmentData: { currentSpeed: 0, freeFlowSpeed: 70, roadClosure: false } }).status, 'DELAYED');
  assert.equal(analyze({ flowSegmentData: { currentSpeed: 62, freeFlowSpeed: 70 } }).averageSpeed, 62);
  assert.equal(analyze({ flowSegmentData: { roadClosure: true, currentSpeed: 'bad' } }).status, 'CLOSED');
  assert.equal(analyze({ flowSegmentData: { roadClosure: true } }).averageSpeed, null);
  assert.equal(analyze({}).status, 'UNKNOWN');

  const requests = [];
  const live = load('src/lib/tomtom.ts', { axios: { get: async (url, options) => {
    requests.push(options.params);
    if (options.params.point.startsWith('52.02691')) throw Object.assign(Error('Request failed with status code 403'), { response: { status: 403 } });
    return { data: { flowSegmentData: { currentSpeed: 55, freeFlowSpeed: 70 } } };
  } } }, { TOMTOM_API_KEY: 'fixture' });
  const result = await live.getTomTomTrafficData();
  assert.equal(requests.length, 2);
  assert.ok(requests.every(params => params.unit === 'mph' && params.key === 'fixture'));
  assert.equal(result.eastbound.status, 'OPEN');
  assert.match(result.eastbound.description, /TomTom/);
  assert.equal(result.westbound.status, 'UNKNOWN', 'one failed direction stays unknown');

  const down = load('src/lib/tomtom.ts', { axios: { get: async () => ({ data: {} }) } });
  await assert.rejects(() => down.getTomTomTrafficData(), /unavailable/);

  const fallback = load('src/lib/traffic.ts', {
    './mapbox': { getMapboxTrafficData: async () => { throw Error('NoRoute'); } },
    './national-highways': { getNationalHighwaysData: async () => { throw Error('429'); } },
    './tomtom': { getTomTomTrafficData: async () => ({ eastbound: { status: 'OPEN', details: 'TomTom', description: 'TomTom', averageSpeed: 50 }, westbound: { status: 'OPEN', details: 'TomTom', description: 'TomTom', averageSpeed: 48 } }) },
  }, { MAPBOX_ACCESS_TOKEN: 'fixture', NATIONAL_HIGHWAYS_API_KEY: 'fixture', TOMTOM_API_KEY: 'fixture' });
  const reading = await fallback.getBridgeTrafficData();
  assert.equal(reading.overallStatus.status, 'OPEN', 'TomTom alone establishes a reading when Mapbox fails');
  console.warn = realWarn;
  console.log('TomTom flow checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
