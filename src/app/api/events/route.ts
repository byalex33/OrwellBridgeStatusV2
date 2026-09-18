import { NextResponse } from 'next/server';
import { BridgeStatusRecord } from '@/types/bridge';
import { mapBridgeRecord } from '@/lib/records';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

function jsonNoStore<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: noStoreHeaders,
  });
}

export async function GET() {
  try {
    const events = await cache.getOrFetch('events-data', async () => {
      const clientPromise = import('@/lib/mongodb').then(m => m.default());
      const client = await clientPromise;

      const db = client.db('paststatus');
      const collection = db.collection('bridgeevents');

      const records = collection
        .aggregate([
          { $match: { status: { $in: ['CLOSED', 'DELAYS', 'DELAYED'] } } },
          { $set: { timestamp: { $convert: { input: '$timestamp', to: 'date', onError: null, onNull: null } } } },
          { $match: { timestamp: { $ne: null } } },
          { $sort: { timestamp: -1 } },
        ]);

      const events: BridgeStatusRecord[] = [];
      const lastShown = new Map<string, number>();
      try {
        for await (const raw of records) {
          const record = mapBridgeRecord(raw);
          if (!record) continue;
          const key = `${record.status}:${record.direction}`;
          const timestamp = new Date(record.timestamp).getTime();
          if ((lastShown.get(key) ?? Infinity) - timestamp < 30 * 60 * 1000) continue;
          lastShown.set(key, timestamp);
          events.push(record);
          if (events.length === 5) break;
        }
      } finally {
        await records.close();
      }
      return events;
    }, 600);
    return jsonNoStore(events);
  } catch (error) {
    console.error('Events API error', { message: error instanceof Error ? error.message : 'Unknown error' });
    return jsonNoStore({ message: 'Events unavailable' }, { status: 503 });
  }
}

