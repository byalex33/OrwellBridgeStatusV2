const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const { analyzeBridgeStatus: analyze } = load('src/lib/traffic.ts', {}, {}, ['analyzeBridgeStatus']);
for (const speed of [undefined, null, NaN, Infinity, -1]) {
  assert.equal(analyze({ flowSegmentData: { currentSpeed: speed, freeFlowSpeed: 70 } }).status, 'UNKNOWN');
}
assert.equal(analyze({ flowSegmentData: { currentSpeed: 0, freeFlowSpeed: 70, roadClosure: false } }).status, 'DELAYED');
assert.equal(analyze({ flowSegmentData: { roadClosure: true } }).status, 'CLOSED');
assert.equal(analyze({ flowSegmentData: {} }).status, 'UNKNOWN');
console.log('Classification checks passed');
