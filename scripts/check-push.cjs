const assert = require('node:assert/strict');
const { createECDH } = require('node:crypto');
const { load } = require('./check-traffic.cjs');
const key = createECDH('prime256v1'); key.generateKeys();
const fixture = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: key.getPublicKey().toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } };
const push = load('src/lib/push.ts', {}, { CRON_SECRET: 'fixture' });
assert.equal(push.validateSubscription(fixture).endpoint, fixture.endpoint);
for (const endpoint of ['http://fcm.googleapis.com/a', 'https://localhost/a', 'https://fcm.googleapis.com.evil.test/a', 'https://fcm.googleapis.com:8080/a', 'https://user@web.push.apple.com/a']) assert.throws(() => push.validateSubscription({ ...fixture, endpoint }));
assert.throws(() => push.validateSubscription({ ...fixture, keys: { ...fixture.keys, auth: 'a' } }));
assert.equal(push.authorizedCron(new Request('https://example.test', { headers: { authorization: 'Bearer fixture' } })), true);
assert.equal(push.authorizedCron(new Request('https://example.test')), false);
assert.equal(push.sameOrigin(new Request('https://example.test/api', { headers: { origin: 'https://evil.test' } })), false);
const data = (eastbound, westbound = 'OPEN') => ({ eastbound: { status: eastbound }, westbound: { status: westbound } });
const baseline = push.nextMonitor(undefined, [], data('CLOSED'));
assert.equal(baseline.pending.length, 0, 'First observation must not broadcast an old closure');
const open = push.nextMonitor(baseline.last, [], data('OPEN'));
const closed = push.nextMonitor(open.last, [], data('CLOSED'));
assert.equal(closed.pending.length, 1);
const unknown = push.nextMonitor(closed.last, closed.pending, data('UNKNOWN'));
assert.equal(unknown.last.eastbound, 'CLOSED');
assert.equal(push.nextMonitor(unknown.last, unknown.pending, data('CLOSED')).pending.length, 1, 'Unknown then closed must not create another event');
assert.equal(push.nextMonitor(closed.last, closed.pending, data('OPEN')).pending.length, 0);
assert.equal(push.nextMonitor(closed.last, closed.pending, data('CLOSED'), new Date(Date.now() + 600001)).pending.length, 0);
assert.equal(push.nextMonitor(open.last, [], data('CLOSED', 'CLOSED')).pending.length, 2);
console.log('Push validation, authorization, baseline, transition and expiry checks passed');
async function senderCheck() {
  let current = data('CLOSED');
  const rows = [0, 1, 2].map(n => ({ ...fixture, _id: String(n), active: true, createdAt: new Date(0) }));
  const monitor = { _id: 'bridge', leaseUntil: new Date(0), last: { eastbound: 'OPEN', westbound: 'OPEN' }, pending: [] };
  let sends = 0;
  const subscriptions = {
    find: query => ({ sort: () => ({ limit: () => ({ toArray: async () => rows.filter(row => row.active && !row.acceptedEvents?.includes(query.acceptedEvents.$ne)) }) }) }),
    findOne: async query => rows.find(row => row._id === query._id && row.active),
    updateOne: async (query, update) => { const row = rows.find(row => row._id === query._id); Object.assign(row, update.$set); if (update.$push) row.acceptedEvents = update.$push.acceptedEvents.$each; },
  };
  const monitors = {
    updateOne: async (_query, update) => { Object.assign(monitor, update.$set); },
    findOneAndUpdate: async (_query, update) => { if (monitor.leaseUntil > new Date()) return null; Object.assign(monitor, update.$set); return { ...monitor }; },
  };
  const sender = load('src/lib/push.ts', {
    './mongodb': async () => ({ db: () => ({ collection: name => name === 'pushMonitor' ? monitors : subscriptions }) }),
    './traffic': { getBridgeTrafficData: async () => ({ directions: current, timestamp: new Date() }) },
    'web-push': { setVapidDetails() {}, async sendNotification(subscription, payload) {
      sends++;
      assert.equal(JSON.parse(payload).url, '/?notification=bridge-closure');
      if (subscription._id === '1') throw { statusCode: 410 };
      if (subscription._id === '2') throw { statusCode: 503 };
    } },
  });
  let result = await sender.checkClosures();
  assert.equal(result.accepted, 1); assert.equal(result.expired, 1); assert.equal(result.failed, 1);
  assert.equal(rows[1].active, false);
  result = await sender.checkClosures();
  assert.equal(sends, 4, 'Only transient failures retry, accepted and expired subscriptions do not');
  assert.equal(result.accepted, 0);
  current = data('UNKNOWN');
  await sender.checkClosures();
  assert.equal(sends, 4, 'No pending sends on unknown traffic');
  monitor.leaseUntil = new Date(Date.now() + 60000);
  assert.equal((await sender.checkClosures()).busy, true);
  assert.equal(sends, 4, 'Overlapping checks cannot send');
  console.log('Mocked push acceptance, expired subscription, retry, unknown status and overlap checks passed');
}
senderCheck().catch(error => { console.error(error); process.exitCode = 1; });

async function endpointCheck() {
  let saved = 0;
  const api = load('src/app/api/push/subscriptions/route.ts', {
    '@/lib/push': { ...push, pushEnabled: () => true, saveSubscription: async () => { saved++; } },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  });
  const request = (origin, body, method = 'POST') => new Request('https://example.test/api/push/subscriptions', { method, headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await api.POST(request('https://evil.test', fixture))).status, 403);
  assert.equal((await api.POST(request('https://example.test', { ...fixture, endpoint: 'https://127.0.0.1/private' }))).status, 400);
  assert.equal((await api.POST(request('https://example.test', { padding: 'a'.repeat(4097) }))).status, 400);
  assert.equal(saved, 0);
  assert.equal((await api.POST(request('https://example.test', fixture))).status, 200);
  assert.equal((await api.DELETE(request('https://example.test', fixture, 'DELETE'))).status, 200);
  assert.equal(saved, 2);
  const check = load('src/app/api/push/check/route.ts', {
    '@/lib/push': { ...push, pushEnabled: () => true, checkClosures: async () => { throw Error('Unavailable'); } },
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  });
  assert.equal((await check.GET(new Request('https://example.test/api/push/check'))).status, 401);
  assert.equal((await check.GET(new Request('https://example.test/api/push/check', { headers: { authorization: 'Bearer fixture' } }))).status, 503);
  console.log('Push API origin, bounded-body, subscription and cron failure checks passed');
}
endpointCheck().catch(error => { console.error(error); process.exitCode = 1; });
