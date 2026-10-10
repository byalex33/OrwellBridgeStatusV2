import getMongoClient from './mongodb';
import { getBridgeTrafficData } from './traffic';

export type TrafficReading = Awaited<ReturnType<typeof getBridgeTrafficData>>;

// The scheduled check polls providers every 30 minutes; pages share the stored reading.
export const READING_MAX_AGE_MS = 35 * 60 * 1000;

let lastReading: TrafficReading | null = null;

function isFresh(reading: TrafficReading | null): reading is TrafficReading {
  const age = reading ? Date.now() - new Date(reading.timestamp).getTime() : NaN;
  return Number.isFinite(age) && age >= -60000 && age <= READING_MAX_AGE_MS;
}

async function readings() {
  return (await getMongoClient()).db('paststatus').collection<TrafficReading & { _id: string }>('trafficReading');
}

// Always calls providers. Only the scheduled check, or an expired shared reading, should reach this.
export async function refreshTrafficReading(): Promise<TrafficReading> {
  const reading = await getBridgeTrafficData();
  lastReading = reading;
  try {
    await (await readings()).updateOne({ _id: 'bridge' }, { $set: reading }, { upsert: true });
  } catch (error) {
    console.error('Traffic reading save failed', { message: error instanceof Error ? error.message : 'Unknown error' });
  }
  return reading;
}

export async function getSharedTrafficReading(): Promise<TrafficReading> {
  try {
    const stored = await (await readings()).findOne({ _id: 'bridge' }, { projection: { _id: 0 } });
    if (isFresh(stored)) return (lastReading = stored);
  } catch (error) {
    console.error('Traffic reading lookup failed', { message: error instanceof Error ? error.message : 'Unknown error' });
  }
  if (isFresh(lastReading)) return lastReading;
  // ponytail: instances that find an expired reading may each refresh once; add a lease if that overlaps quota.
  return refreshTrafficReading();
}
