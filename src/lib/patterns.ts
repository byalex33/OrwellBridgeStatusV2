import getMongoClient from './mongodb';
import type { DirectionalStatus } from './traffic';
import type { DirectionPattern, TrafficPatterns } from '@/types/bridge';

const DIRECTIONS = ['eastbound', 'westbound'] as const;
type Direction = typeof DIRECTIONS[number];
type SampleDirection = { status: string; speed: number | null };
export type TrafficSample = { timestamp: Date } & Record<Direction, SampleDirection>;

// Patterns describe normal running, so closures and unknown readings are left out.
const WINDOW_DAYS = 56;
const MIN_HOURLY_DAYS = 2;
const MIN_BUCKET_SAMPLES = 2;

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
});
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function londonTime(date: Date) {
  const parts = Object.fromEntries(londonParts.formatToParts(date).map(part => [part.type, part.value]));
  return { day: WEEKDAYS.indexOf(parts.weekday), hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` };
}

function usableSpeed(value: SampleDirection | undefined) {
  return value && (value.status === 'OPEN' || value.status === 'DELAYED') && typeof value.speed === 'number' &&
    Number.isFinite(value.speed) && value.speed > 0 && value.speed < 120 ? value.speed : null;
}

const round = (value: number) => Math.round(value * 10) / 10;

function averages(sums: number[], counts: number[], minimum: number) {
  return sums.map((sum, i) => counts[i] >= minimum ? round(sum / counts[i]) : null);
}

function slowest(values: Array<number | null>) {
  let index = -1;
  values.forEach((value, i) => { if (value !== null && (index < 0 || value < values[index]!)) index = i; });
  return index < 0 ? null : { index, speed: values[index]! };
}

export function buildPatterns(samples: TrafficSample[]): TrafficPatterns {
  const days = new Set<string>();
  let since: Date | null = null;
  const directions = {} as Record<Direction, DirectionPattern>;
  const buckets = Object.fromEntries(DIRECTIONS.map(direction => [direction, {
    hourSums: Array(24).fill(0), hourCounts: Array(24).fill(0), daySums: Array(7).fill(0), dayCounts: Array(7).fill(0), total: 0, count: 0,
  }])) as Record<Direction, { hourSums: number[]; hourCounts: number[]; daySums: number[]; dayCounts: number[]; total: number; count: number }>;

  for (const sample of samples) {
    const timestamp = new Date(sample?.timestamp);
    if (!Number.isFinite(timestamp.getTime())) continue;
    const time = londonTime(timestamp);
    if (time.day < 0 || !Number.isInteger(time.hour)) continue;
    for (const direction of DIRECTIONS) {
      const speed = usableSpeed(sample[direction]);
      if (speed === null) continue;
      const bucket = buckets[direction];
      bucket.hourSums[time.hour] += speed; bucket.hourCounts[time.hour]++;
      bucket.daySums[time.day] += speed; bucket.dayCounts[time.day]++;
      bucket.total += speed; bucket.count++;
      days.add(time.date);
      if (!since || timestamp < since) since = timestamp;
    }
  }

  for (const direction of DIRECTIONS) {
    const bucket = buckets[direction];
    const byHour = days.size >= MIN_HOURLY_DAYS ? averages(bucket.hourSums, bucket.hourCounts, MIN_BUCKET_SAMPLES) : Array(24).fill(null);
    const byDay = averages(bucket.daySums, bucket.dayCounts, 1);
    const weekComplete = byDay.every(value => value !== null);
    const hour = slowest(byHour);
    const day = weekComplete ? slowest(byDay) : null;
    directions[direction] = {
      typical: bucket.count ? round(bucket.total / bucket.count) : null,
      samples: bucket.count,
      byHour,
      byDay: weekComplete ? byDay : Array(7).fill(null),
      slowestHour: hour && { hour: hour.index, speed: hour.speed },
      slowestDay: day && { day: WEEKDAYS[day.index], speed: day.speed },
    };
  }
  return { since: since ? (since as Date).toISOString() : null, days: days.size, directions };
}

async function samplesCollection() {
  return (await getMongoClient()).db('paststatus').collection<TrafficSample>('trafficsamples');
}

let indexed = false;

export async function recordTrafficSample(directions: DirectionalStatus, timestamp: Date) {
  const collection = await samplesCollection();
  if (!indexed) {
    await collection.createIndex({ timestamp: -1 });
    indexed = true;
  }
  const entry = (direction: Direction) => ({ status: directions[direction].status, speed: directions[direction].averageSpeed });
  await collection.insertOne({ timestamp, eastbound: entry('eastbound'), westbound: entry('westbound') });
}

export async function getTrafficPatterns(): Promise<TrafficPatterns> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const samples = await (await samplesCollection()).find({ timestamp: { $gte: since } }, { projection: { _id: 0 } }).toArray();
  return buildPatterns(samples);
}
