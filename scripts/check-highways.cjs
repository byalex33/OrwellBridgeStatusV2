const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const { parseClosures } = load('src/lib/national-highways.ts');
const now = Date.now();
const payload = kind => ({ D2Payload: { publicationTime: new Date(now).toISOString(), situation: [{ situationRecord: [{ sitRoadOrCarriagewayOrLaneManagement: {
  roadOrCarriagewayOrLaneManagementType: { value: kind }, validity: { validityStatus: 'active', validityTimeSpecification: { overallStartTime: new Date(now - 60000).toISOString() } },
  locationReference: { locLinearLocation: { gmlLineString: { locGmlLineString: { posList: '52.027 1.15 52.027 1.18' } } }, locSingleRoadLinearLocation: { linearWithinLinearElement: [{ directionOnLinearSection: 'eastBound' }] } }
} }] }] } });
assert.throws(() => parseClosures({}, now), /current publication/);
assert.equal(parseClosures({ D2Payload: { publicationTime: new Date(now).toISOString(), situation: [] } }, now).eastbound.status, 'UNKNOWN');
assert.equal(parseClosures(payload('roadClosed'), now).eastbound.status, 'CLOSED');
assert.equal(parseClosures(payload('roadClosed'), now).westbound.status, 'UNKNOWN');
assert.equal(parseClosures(payload('laneClosures'), now).eastbound.status, 'DELAYED');
const expired = payload('roadClosed');
expired.D2Payload.situation[0].situationRecord[0].sitRoadOrCarriagewayOrLaneManagement.validity.validityTimeSpecification.overallEndTime = new Date(now - 1).toISOString();
assert.equal(parseClosures(expired, now).eastbound.status, 'UNKNOWN');
console.log('Highways evidence checks passed');
