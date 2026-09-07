import { after, NextResponse } from 'next/server';
import { BridgeStatusRecord } from '@/types/bridge';
import { getBridgeTrafficData } from '@/lib/traffic';
import type { DirectionalStatus, OverallStatus } from '@/lib/traffic';
import { mapBridgeRecord, type DbBridgeRecord } from '@/lib/records';
import { saveBridgeTransition } from '@/lib/history';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BridgeCacheEntry = {
  records: BridgeStatusRecord[];
  timestamp: Date;
  trafficData: {
    directions: DirectionalStatus;
    overallStatus: OverallStatus;
  };
};

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

async function getBridgeCollection() {
  const clientPromise = import('@/lib/mongodb').then((m) => m.default());
  const client = await clientPromise;
  const db = client.db('paststatus');
  return db.collection<DbBridgeRecord>('bridgeevents');
}

async function fetchHistoricalRecords(limit: number): Promise<BridgeStatusRecord[]> {
  const collection = await getBridgeCollection();
  const records = await collection
    .aggregate<DbBridgeRecord>([
      { $set: { timestamp: { $convert: { input: '$timestamp', to: 'date', onError: null, onNull: null } } } },
      { $match: { timestamp: { $ne: null } } },
      { $sort: { timestamp: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return records
    .map(mapBridgeRecord)
    .filter((record): record is BridgeStatusRecord => record !== null)
    .slice(0, limit);
}

function buildCurrentRecord(trafficData: Awaited<ReturnType<typeof getBridgeTrafficData>>): BridgeStatusRecord {
  return {
    _id: `current_${Date.now()}`,
    status: trafficData.overallStatus.status,
    timestamp: trafficData.timestamp.toISOString(),
    description: trafficData.overallStatus.details,
    direction: trafficData.directions.eastbound.status === trafficData.overallStatus.status && trafficData.directions.westbound.status !== trafficData.overallStatus.status ? 'eastbound'
      : trafficData.directions.westbound.status === trafficData.overallStatus.status && trafficData.directions.eastbound.status !== trafficData.overallStatus.status ? 'westbound' : 'both',
    speedUnit: 'mph',
    averageSpeed: trafficData.directions.eastbound.averageSpeed == null || trafficData.directions.westbound.averageSpeed == null ? null : Math.round(
      (trafficData.directions.eastbound.averageSpeed + trafficData.directions.westbound.averageSpeed) / 2
    ),
    __v: 0,
  };
}

async function getDatabaseFallbackRecords(): Promise<BridgeStatusRecord[]> {
  try {
    return await fetchHistoricalRecords(1);
  } catch (dbError) {
    console.error('MongoDB fallback lookup failed:', dbError);
    return [];
  }
}

function makeCacheEntry(
  records: BridgeStatusRecord[],
  trafficData: Awaited<ReturnType<typeof getBridgeTrafficData>>
): BridgeCacheEntry {
  return {
    records,
    timestamp: trafficData.timestamp,
    trafficData: {
      directions: trafficData.directions,
      overallStatus: trafficData.overallStatus,
    },
  };
}

export async function GET() {
  try {
    const cacheResult = cache.getWithStale<BridgeCacheEntry>('bridge-status');

    if (cacheResult.data && !cacheResult.isStale) {
      return jsonNoStore({
        success: true,
        data: cacheResult.data.records,
        cached: true,
        timestamp: cacheResult.data.timestamp,
        trafficData: cacheResult.data.trafficData,
      });
    }

    // ponytail: per-instance deduplication; use shared coordination if provider quotas require it.
    const cacheEntry = await cache.getOrFetch('bridge-status', async () => {
      const trafficData = await getBridgeTrafficData();
      const currentRecord = buildCurrentRecord(trafficData);
      after(async () => {
        try {
          const client = await (await import('@/lib/mongodb')).default();
          await saveBridgeTransition(client, currentRecord, trafficData.directions);
        } catch (error) {
          console.error('Bridge history write failed', { message: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
      return makeCacheEntry([currentRecord], trafficData);
    }, 600, 300);

    return jsonNoStore({
      success: true,
      data: cacheEntry.records,
      realTime: true,
      timestamp: cacheEntry.timestamp,
      trafficData: cacheEntry.trafficData,
    });
  } catch (error) {
    console.error('Failed to fetch real traffic data, using fallback', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    const cachedData = cache.get<BridgeCacheEntry>('bridge-status');
    if (cachedData) {
      return jsonNoStore({
        success: true,
        data: cachedData.records,
        fallback: true,
        stale: true,
        cached: true,
        timestamp: cachedData.timestamp,
        trafficData: cachedData.trafficData,
      });
    }

    const databaseRecords = await getDatabaseFallbackRecords();
    if (databaseRecords.length > 0) {
      return jsonNoStore({
        success: true,
        data: databaseRecords,
        fallback: true,
        stale: true,
        timestamp: databaseRecords[0].timestamp,
        error: 'Real-time traffic data unavailable',
      });
    }

    return jsonNoStore(
      {
        success: false,
        data: [],
        error: 'Real-time traffic data and database history are unavailable',
      },
      { status: 503 }
    );
  }
}

