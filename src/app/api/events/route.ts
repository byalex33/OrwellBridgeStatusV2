import { NextResponse } from 'next/server';
import { BridgeStatusRecord } from '@/types/bridge';
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
      const clientPromise = import('@/lib/mongodb').then(m => m.default);
      const client = await clientPromise;

      const db = client.db('paststatus');
      const collection = db.collection('bridgeevents');

      const records = await collection
        .find({ status: { $in: ['CLOSED', 'DELAYS', 'DELAYED'] } })
        .sort({ timestamp: -1 })
        .limit(5)
        .toArray();

      events = records.map((record) => ({
        _id: record._id.toString(),
        status: record.status,
        timestamp: record.timestamp.toISOString(),
        description: record.description,
        direction: record.direction,
        averageSpeed: record.averageSpeed,
        __v: record.__v || 0,
      }));


    } catch (dbError) {
      console.error('MongoDB error in events API:', dbError);
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
    console.error('Events API error:', error);

    return jsonNoStore([], { status: 503 });
  }
}
