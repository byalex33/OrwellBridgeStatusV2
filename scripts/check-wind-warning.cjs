const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const weather = load('src/lib/weather.ts', { '@/types/bridge': {} });
const now = Date.UTC(2026, 9, 10, 12, 30);
const hour = 3600;
// Hourly timestamps (seconds) from the current hour, as Open-Meteo returns them.
const times = Array.from({ length: 26 }, (_, i) => Date.UTC(2026, 9, 10, 12 + i) / 1000);
const gusts = (overrides = {}) => times.map((_, i) => overrides[i] ?? 20);
const warn = (g, t = times) => weather.getWindWarning(t, g, now);

assert.equal(warn(gusts()), null, 'calm forecast has no warning');
assert.equal(warn(gusts({ 3: 50 })), null, 'exactly 50mph is not above the limit threshold');

const limit = warn(gusts({ 3: 51, 4: 55, 6: 52 }));
assert.equal(limit.level, 'limit');
assert.equal(limit.peakGust, 55);
assert.equal(limit.from, new Date((times[3] - hour) * 1000).toISOString(), 'window starts at the beginning of the first windy hour');
assert.equal(limit.until, new Date(times[6] * 1000).toISOString());

const closure = warn(gusts({ 2: 55, 5: 60, 7: 64.6 }));
assert.equal(closure.level, 'closure', '60mph gusts mean closure');
assert.equal(closure.peakGust, 65);
assert.equal(closure.from, new Date((times[5] - hour) * 1000).toISOString(), 'closure window uses closure-level hours only');

assert.equal(warn(gusts({ 0: 70 })), null, 'the hour already ended is ignored');
assert.equal(warn(gusts({ 25: 70 })), null, 'gusts beyond 24 hours are ignored');
assert.equal(warn(gusts({ 3: NaN })), undefined, 'invalid gusts make the forecast unavailable');
assert.equal(warn(gusts({ 3: -1 })), undefined);
assert.equal(warn(gusts().slice(1)), undefined, 'mismatched arrays are unavailable');
assert.equal(weather.getWindWarning(undefined, undefined, now), undefined);
assert.equal(warn([], []), undefined, 'no forecast hours is unavailable, not calm');
console.log('Wind warning threshold and window checks passed');
