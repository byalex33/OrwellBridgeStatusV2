import { createHash, randomUUID, timingSafeEqual, ECDH } from 'node:crypto';
import { Buffer } from 'node:buffer';
import webpush from 'web-push';
import getMongoClient from './mongodb';
import { getBridgeTrafficData, type DirectionalStatus } from './traffic';

const directions = ['eastbound', 'westbound'] as const;
type Direction = typeof directions[number];
type Status = DirectionalStatus[Direction]['status'];
type Closure = { id: string; direction: Direction; at: Date };
type Monitor = { _id: string; owner?: string; leaseUntil: Date; last?: Partial<Record<Direction, Status>>; pending?: Closure[] };
type Subscriber = { _id: string; endpoint: string; keys: { p256dh: string; auth: string }; active: boolean; createdAt: Date; analyticsConsent: boolean; acceptedEvents?: string[] };

export function pushEnabled() {
  return process.env.PUSH_SCHEDULE_ENABLED === 'true' && ['MONGODB_URI', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'CRON_SECRET'].every(key => !!process.env[key]);
}

export function validateSubscription(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Invalid subscription');
  const value = input as Partial<Subscriber>;
  if (typeof value.endpoint !== 'string' || value.endpoint.length > 2048) throw new Error('Invalid endpoint');
  const url = new URL(value.endpoint);
  const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'web.push.apple.com' ||
    url.hostname === 'updates.push.services.mozilla.com' || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || url.pathname === '/') throw new Error('Unsupported push endpoint');
  for (const [key, size] of [['p256dh', 65], ['auth', 16]] as const) {
    const encoded = value.keys?.[key];
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+$/.test(encoded) || Buffer.from(encoded, 'base64url').length !== size) throw new Error('Invalid subscription keys');
  }
  ECDH.convertKey(Buffer.from(value.keys!.p256dh, 'base64url'), 'prime256v1');
  return { endpoint: url.href, keys: { p256dh: value.keys!.p256dh, auth: value.keys!.auth }, analyticsConsent: value.analyticsConsent === true };
}

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}

export function authorizedCron(request: Request) {
  const expected = process.env.CRON_SECRET && `Bearer ${process.env.CRON_SECRET}`;
  const actual = request.headers.get('authorization') ?? '';
  return !!expected && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

async function collections() {
  const db = (await getMongoClient()).db('paststatus');
  return { subscriptions: db.collection<Subscriber>('pushSubscriptions'), monitors: db.collection<Monitor>('pushMonitor') };
}

export async function saveSubscription(input: unknown, active: boolean) {
  const subscription = validateSubscription(input);
  const { subscriptions } = await collections();
  const _id = createHash('sha256').update(subscription.endpoint).digest('hex');
  // Keys are the subscription's capability; knowing an endpoint alone cannot disable it.
  const existing = await subscriptions.findOne({ _id });
  if (existing && (existing.keys.auth !== subscription.keys.auth || existing.keys.p256dh !== subscription.keys.p256dh)) throw new Error('Subscription keys do not match');
  if (!active) {
    await subscriptions.updateOne({ _id, 'keys.auth': subscription.keys.auth, 'keys.p256dh': subscription.keys.p256dh }, { $set: { active: false } });
  } else {
    await subscriptions.updateOne({ _id, 'keys.auth': subscription.keys.auth, 'keys.p256dh': subscription.keys.p256dh }, {
      $set: { ...subscription, active: true, ...(!existing?.active ? { createdAt: new Date() } : {}) },
    }, { upsert: true });
  }
}

// Unknown readings preserve the last known status, including the first baseline.
export function nextMonitor(last: Monitor['last'] = {}, pending: Closure[] = [], current: DirectionalStatus, now = new Date()) {
  const next = { ...last };
  const events = pending.filter(event => now.getTime() - new Date(event.at).getTime() < 600000 &&
    (current[event.direction].status === 'CLOSED' || current[event.direction].status === 'UNKNOWN'));
  for (const direction of directions) {
    const status = current[direction].status;
    if (status === 'UNKNOWN') continue;
    if (status === 'CLOSED' && last[direction] && last[direction] !== 'CLOSED') events.push({ id: randomUUID(), direction, at: now });
    next[direction] = status;
  }
  return { last: next, pending: events };
}

export async function checkClosures() {
  const { subscriptions, monitors } = await collections();
  await monitors.updateOne({ _id: 'bridge' }, { $setOnInsert: { leaseUntil: new Date(0), last: {}, pending: [] } }, { upsert: true });
  const owner = randomUUID();
  const start = Date.now();
  // ponytail: one monitor lease and bounded batches; use a durable queue if subscriber volume exceeds a check's budget.
  const monitor = await monitors.findOneAndUpdate({ _id: 'bridge', leaseUntil: { $lte: new Date() } }, {
    $set: { owner, leaseUntil: new Date(start + 90000) },
  }, { returnDocument: 'after' });
  if (!monitor) return { busy: true, accepted: 0, expired: 0, failed: 0 };
  const counts = { busy: false, accepted: 0, expired: 0, failed: 0 };
  try {
    const traffic = await getBridgeTrafficData(); // Fetch providers directly, never use the page's cached status.
    const age = Date.now() - new Date(traffic.timestamp).getTime();
    if (!Number.isFinite(age) || age < -60000 || age > 60000) throw new Error('Stale traffic reading');
    const next = nextMonitor(monitor.last, monitor.pending, traffic.directions);
    await monitors.updateOne({ _id: 'bridge', owner }, { $set: { ...next, checkedAt: new Date() } });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    for (const event of next.pending) {
      if (traffic.directions[event.direction].status !== 'CLOSED') continue;
      const batch = await subscriptions.find({ active: true, createdAt: { $lte: new Date(event.at) }, acceptedEvents: { $ne: event.id } }).sort({ lastAttemptAt: 1 }).limit(100).toArray();
      for (const subscriber of batch) {
        if (Date.now() - start > 45000) return counts;
        // Recheck opt-out immediately before the external send.
        if (!await subscriptions.findOne({ _id: subscriber._id, active: true })) continue;
        await subscriptions.updateOne({ _id: subscriber._id }, { $set: { lastAttemptAt: new Date() } });
        try {
          await webpush.sendNotification(subscriber, JSON.stringify({ title: 'Orwell Bridge closure', body: `A closure is reported ${event.direction}. Check current conditions before travelling.`, url: '/?notification=bridge-closure', id: event.id }), { TTL: 300, timeout: 5000, urgency: 'high', topic: event.id.replaceAll('-', '') });
          // A push service accepting a message does not prove device delivery.
          await subscriptions.updateOne({ _id: subscriber._id }, { $push: { acceptedEvents: { $each: [event.id], $slice: -20 } }, $set: { lastAcceptedAt: new Date() }, $inc: { pushAccepted: 1 } });
          counts.accepted++;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await subscriptions.updateOne({ _id: subscriber._id }, { $set: { active: false, disabledAt: new Date() } });
            counts.expired++;
          } else counts.failed++;
        }
      }
    }
    return counts;
  } finally {
    await monitors.updateOne({ _id: 'bridge', owner }, { $set: { leaseUntil: new Date(0), lastRunAt: new Date(), lastRun: counts } });
  }
}
