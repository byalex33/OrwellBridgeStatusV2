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
    const cachedEvents = cache.get<BridgeStatusRecord[] | {message: string}>('events-data');
    if (cachedEvents) {
      return jsonNoStore(cachedEvents);
    }

    let events: BridgeStatusRecord[] = [];
    try {
      const clientPromise = import('@/lib/mongodb').then(m => m.default());
      const client = await clientPromise;

      const db = client.db('paststatus');
      const collection = db.collection('bridgeevents');

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const records = await collection
        .aggregate([
          { $match: { status: { $in: ['CLOSED', 'DELAYS', 'DELAYED'] } } },
          { $set: { timestamp: { $convert: { input: '$timestamp', to: 'date', onError: null, onNull: null } } } },
          { $match: { timestamp: { $gte: since } } },
          { $sort: { timestamp: -1 } },
          { $limit: 5 },
        ])
        .toArray();

      events = records.map(mapBridgeRecord).filter((record): record is BridgeStatusRecord => record !== null);


    } catch (dbError) {
      console.error('MongoDB error in events API', {
        message: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
      const fallbackResponse = {
        message: "Events unavailable"
      };
      return jsonNoStore(fallbackResponse, { status: 503 });
    }

    if (events.length === 0) {
      const responseData = {
        message: "No closures or delays in the last 24 hours"
      };
      cache.set('events-data', responseData, 600);
      return jsonNoStore(responseData);
    }

    cache.set('events-data', events, 600);
    return jsonNoStore(events);

  } catch (error) {
    console.error('Events API error', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    return jsonNoStore([], { status: 503 });
  }
}
