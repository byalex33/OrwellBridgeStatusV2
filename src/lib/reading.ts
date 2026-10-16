import getMongoClient from './mongodb';
import { getBridgeTrafficData } from './traffic';
import { recordTrafficSample } from './patterns';

export type TrafficReading = Awaited<ReturnType<typeof getBridgeTrafficData>>;

// The scheduled check polls providers every 30 minutes; pages share the stored reading.
export const READING_MAX_AGE_MS = 35 * 60 * 1000;
// Consecutive failures wait 30m, 1h, 2h, then 4h before polling providers again.
const BACKOFF_BASE_MS = 30 * 60 * 1000;
const BACKOFF_MAX_MS = 4 * 60 * 60 * 1000;
// Covers cron jitter so a 30-minute backoff does not skip the next scheduled run.
const BACKOFF_GRACE_MS = 2 * 60 * 1000;
// Longer than the grace so an in-flight refresh is never claimed twice.
const REFRESH_LEASE_MS = 5 * 60 * 1000;
// Pages share one lookup per instance at most this often, even while the reading is expired.
const LOOKUP_INTERVAL_MS = 30 * 1000;

type RefreshState = { _id: 'refresh'; retryAt: Date; failures: number; owner?: string; lastError?: string; lastFailureAt?: Date; lastSuccessAt?: Date };

export class ReadingUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadingUnavailableError';
  }
}

let lastReading: TrafficReading | null = null;
let lastLookupAt = 0;
let localRetryAt = 0;
let localFailures = 0;

function isFresh(reading: TrafficReading | null): reading is TrafficReading {
  const age = reading ? Date.now() - new Date(reading.timestamp).getTime() : NaN;
  return Number.isFinite(age) && age >= -60000 && age <= READING_MAX_AGE_MS;
}

export function backoffMs(failures: number) {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1), BACKOFF_MAX_MS);
}

async function database() {
  return (await getMongoClient()).db('paststatus');
}

async function readings() {
  return (await database()).collection<TrafficReading & { _id: string }>('trafficReading');
}

async function refreshStates() {
  return (await database()).collection<RefreshState>('trafficRefresh');
}

// Claims the refresh slot unless a backoff or another refresh holds it. Returns the owner id, or null when skipped.
async function claimRefresh(): Promise<string | null> {
  const now = Date.now();
  const owner = crypto.randomUUID();
  try {
    const states = await refreshStates();
    await states.updateOne({ _id: 'refresh' }, { $setOnInsert: { retryAt: new Date(0), failures: 0 } }, { upsert: true });
    const claimed = await states.findOneAndUpdate(
      { _id: 'refresh', retryAt: { $lte: new Date(now + BACKOFF_GRACE_MS) } },
      { $set: { owner, retryAt: new Date(now + REFRESH_LEASE_MS) } },
      { returnDocument: 'after' }
    );
    return claimed ? owner : null;
  } catch (error) {
    // Without the shared state, fall back to this instance's own backoff.
    console.error('Traffic refresh state unavailable', { message: error instanceof Error ? error.message : 'Unknown error' });
    return localRetryAt - BACKOFF_GRACE_MS <= now ? owner : null;
  }
}

async function releaseRefresh(owner: string, error: unknown) {
  const now = new Date(Date.now());
  if (error) {
    localFailures++;
    localRetryAt = now.getTime() + backoffMs(localFailures);
  } else {
    localFailures = 0;
    localRetryAt = 0;
  }
  try {
    const states = await refreshStates();
    if (!error) {
      await states.updateOne({ _id: 'refresh', owner }, { $set: { retryAt: new Date(0), failures: 0, lastSuccessAt: now } });
      return;
    }
    const state = await states.findOne({ _id: 'refresh', owner });
    if (!state) return;
    const failures = (state.failures ?? 0) + 1;
    await states.updateOne({ _id: 'refresh', owner }, { $set: {
      failures,
      retryAt: new Date(now.getTime() + backoffMs(failures)),
      lastFailureAt: now,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    } });
  } catch (stateError) {
    console.error('Traffic refresh state save failed', { message: stateError instanceof Error ? stateError.message : 'Unknown error' });
  }
}

// Polls providers. Only the scheduled check calls this; failures back off before the next attempt.
export async function refreshTrafficReading(): Promise<TrafficReading> {
  const owner = await claimRefresh();
  if (!owner) throw new ReadingUnavailableError('Traffic refresh is backing off after a failure or already running');
  let reading: TrafficReading;
  try {
    reading = await getBridgeTrafficData();
  } catch (error) {
    await releaseRefresh(owner, error);
    throw error;
  }
  await releaseRefresh(owner, null);
  lastReading = reading;
  try {
    await (await readings()).updateOne({ _id: 'bridge' }, { $set: reading }, { upsert: true });
  } catch (error) {
    console.error('Traffic reading save failed', { message: error instanceof Error ? error.message : 'Unknown error' });
  }
  try {
    await recordTrafficSample(reading.directions, reading.timestamp);
  } catch (error) {
    console.error('Traffic sample save failed', { message: error instanceof Error ? error.message : 'Unknown error' });
  }
  return reading;
}

// Read-only: page traffic never polls providers, however many visitors arrive.
export async function getSharedTrafficReading(): Promise<TrafficReading> {
  if (isFresh(lastReading) && Date.now() - lastLookupAt < LOOKUP_INTERVAL_MS) return lastReading;
  if (Date.now() - lastLookupAt >= LOOKUP_INTERVAL_MS) {
    lastLookupAt = Date.now();
    try {
      const stored = await (await readings()).findOne({ _id: 'bridge' }, { projection: { _id: 0 } });
      if (isFresh(stored)) return (lastReading = stored);
    } catch (error) {
      console.error('Traffic reading lookup failed', { message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  if (isFresh(lastReading)) return lastReading;
  throw new ReadingUnavailableError('No fresh shared traffic reading');
}
