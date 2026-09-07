const assert = require('node:assert/strict');
function validateHealth(body, now = Date.now()) {
  assert.equal(body?.success, true, 'Bridge API failed');
  assert.ok(!body.fallback && !body.stale, 'Bridge data is fallback or stale');
  const age = now - Date.parse(body.timestamp);
  assert.ok(Number.isFinite(age) && age >= -60000 && age <= 600000, 'Bridge observation exceeds ten-minute freshness budget');
  for (const direction of ['eastbound','westbound']) assert.ok(['OPEN','DELAYED','CLOSED'].includes(body.trafficData?.directions?.[direction]?.status), direction + ' status is unconfirmed');
}
async function main() {
  const now = Date.now();
  const healthy = { success: true, timestamp: new Date(now).toISOString(), trafficData: { directions: { eastbound: { status: 'OPEN' }, westbound: { status: 'CLOSED' } } } };
  validateHealth(healthy, now);
  for (const change of [{ success: false }, { stale: true }, { fallback: true }, { timestamp: 'bad' }, { timestamp: new Date(now - 601000).toISOString() }, { trafficData: {} }]) assert.throws(() => validateHealth({ ...healthy, ...change }, now));
  if (process.argv.includes('--live')) {
    const response = await fetch('https://www.orwellbridgestatus.com/api/bridge-status', { signal: AbortSignal.timeout(20000), cache: 'no-store' });
    assert.ok(response.ok, 'Bridge API HTTP ' + response.status);
    validateHealth(await response.json());
  }
  console.log('Bridge freshness/availability check passed');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
