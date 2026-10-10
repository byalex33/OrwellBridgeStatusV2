const assert = require('node:assert/strict');
const { load } = require('./check-traffic.cjs');
const patterns = load('src/lib/patterns.ts', { './mongodb': { default: async () => { throw Error('not used'); } } });
const reading = (status, speed) => ({ status, speed });
// 2026-10-05 is a Monday; October is BST (UTC+1), so 07:00Z is 8am in London.
const at = (day, utcHour, minute = 0) => new Date(Date.UTC(2026, 9, 5 + day, utcHour, minute));
const sample = (timestamp, east, west = east) => ({ timestamp, eastbound: east, westbound: west });

const empty = patterns.buildPatterns([]);
assert.equal(empty.days, 0);
assert.equal(empty.since, null);
assert.equal(empty.directions.eastbound.typical, null);
assert.ok(empty.directions.eastbound.byHour.every(value => value === null));

const oneDay = patterns.buildPatterns([sample(at(0, 7), reading('OPEN', 40)), sample(at(0, 7, 30), reading('OPEN', 42))]);
assert.equal(oneDay.days, 1);
assert.equal(oneDay.directions.eastbound.typical, 41);
assert.ok(oneDay.directions.eastbound.byHour.every(value => value === null), 'hourly profile waits for two days');

const week = [];
for (let day = 0; day < 7; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const london = (hour + 1) % 24;
    const speed = london === 8 ? 30 : day === 5 ? 50 : 55;
    week.push(sample(at(day, hour), reading('OPEN', speed), reading(day === 2 ? 'DELAYED' : 'OPEN', speed - 1)));
    week.push(sample(at(day, hour, 30), reading('OPEN', speed)));
  }
}
week.push(sample(at(1, 12), reading('CLOSED', 5)), sample(at(1, 12), reading('UNKNOWN', 5)), sample(at(1, 13), reading('OPEN', null)));
week.push(sample(at(1, 14), reading('OPEN', NaN)), sample('bad', reading('OPEN', 10)), sample(at(1, 15), reading('OPEN', 500)));
const full = patterns.buildPatterns(week);
assert.equal(full.days, 8, 'London calendar days, including the evening that spills into the next date');
const east = full.directions.eastbound;
assert.equal(east.slowestHour.hour, 8, 'hours are bucketed in Europe/London time');
assert.equal(east.slowestHour.speed, 30);
assert.equal(east.slowestDay.day, 'Sat');
assert.equal(east.byDay.length, 7);
assert.ok(east.byDay.every(value => value !== null));
assert.ok(east.byHour.every(value => value !== null));
assert.ok(east.typical > 50 && east.typical < 55, 'closures, unknown and implausible speeds are excluded');
assert.equal(full.directions.westbound.samples, 7 * 24 * 2, 'delayed traffic still counts as normal running');
assert.equal(full.since, at(0, 0).toISOString());

const partial = patterns.buildPatterns(week.filter(s => s.timestamp instanceof Date && s.timestamp < at(3, 0)));
assert.ok(partial.directions.eastbound.byHour.some(value => value !== null), 'hourly profile appears after two days');
assert.ok(partial.directions.eastbound.byDay.every(value => value === null), 'day-by-day waits for a full week');
assert.equal(partial.directions.eastbound.slowestDay, null);
console.log('Traffic pattern aggregation checks passed');
