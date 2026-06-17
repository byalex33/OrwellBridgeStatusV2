import { NextResponse } from 'next/server';
import { BridgeStatusRecord } from '@/types/bridge';
import { getBridgeTrafficData } from '@/lib/traffic';
import type { DirectionalStatus, OverallStatus } from '@/lib/traffic';
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

type DbBridgeRecord = {
  _id?: { toString(): string };
  status?: string;
  timestamp?: Date | string;
  description?: string;
  direction?: string;
  averageSpeed?: number;
  __v?: number;
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

function normalizeStatus(status: string | undefined): BridgeStatusRecord['status'] {
  if (status === 'CLOSED' || status === 'DELAYED' || status === 'OPEN' || status === 'UNKNOWN') {
    return status;
  }

  if (status === 'DELAYS') {
    return 'DELAYED';
  }

  return 'UNKNOWN';
}

function normalizeDirection(direction: string | undefined): BridgeStatusRecord['direction'] {
  if (
    direction === 'both' ||
    direction === 'north' ||
    direction === 'south' ||
    direction === 'eastbound' ||
    direction === 'westbound'
  ) {
    return direction;
  }

  return 'both';
}

function normalizeTimestamp(timestamp: Date | string | undefined): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function mapBridgeRecord(record: DbBridgeRecord): BridgeStatusRecord {
  return {
    _id: record._id?.toString() || `record_${normalizeTimestamp(record.timestamp)}`,
    status: normalizeStatus(record.status),
    timestamp: normalizeTimestamp(record.timestamp),
    description: record.description || 'No description available',
    direction: normalizeDirection(record.direction),
    averageSpeed: record.averageSpeed || 0,
    __v: record.__v || 0,
  };
}

async function getBridgeCollection() {
  const clientPromise = import('@/lib/mongodb').then((m) => m.default);
  const client = await clientPromise;
  const db = client.db('paststatus');
  return db.collection<DbBridgeRecord>('bridgeevents');
}

async function fetchHistoricalRecords(limit: number, excludedId?: string): Promise<BridgeStatusRecord[]> {
  const collection = await getBridgeCollection();
  const records = await collection
    .find({})
    .sort({ timestamp: -1 })
    .limit(excludedId ? limit + 1 : limit)
    .toArray();

  return records
    .map(mapBridgeRecord)
    .filter((record) => record._id !== excludedId)
    .slice(0, limit);
}

function buildCurrentRecord(trafficData: Awaited<ReturnType<typeof getBridgeTrafficData>>): BridgeStatusRecord {
  return {
    _id: `current_${Date.now()}`,
    status: trafficData.overallStatus.status,
    timestamp: trafficData.timestamp.toISOString(),
    description: trafficData.overallStatus.details,
    direction: 'both',
    averageSpeed: Math.round(
      (trafficData.directions.eastbound.averageSpeed + trafficData.directions.westbound.averageSpeed) / 2
    ),
    __v: 0,
  };
}

async function saveCurrentRecord(currentRecord: BridgeStatusRecord): Promise<BridgeStatusRecord[]> {
  const collection = await getBridgeCollection();

  console.log('Saving current status to MongoDB:', currentRecord.status);
  const insertResult = await collection.insertOne({
    status: currentRecord.status,
    timestamp: new Date(currentRecord.timestamp),
    description: currentRecord.description,
    direction: currentRecord.direction,
    averageSpeed: currentRecord.averageSpeed,
  });
  console.log('MongoDB insert result:', insertResult.insertedId);

  return fetchHistoricalRecords(19, insertResult.insertedId.toString());
}

async function getDatabaseFallbackRecords(): Promise<BridgeStatusRecord[]> {
  try {
    return await fetchHistoricalRecords(20);
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

async function refreshBridgeData() {
  try {
    const trafficData = await getBridgeTrafficData();
    const currentRecord = buildCurrentRecord(trafficData);

    let historicalRecords: BridgeStatusRecord[] = [];
    try {
      historicalRecords = await saveCurrentRecord(currentRecord);
    } catch (dbError) {
      console.error('MongoDB error during background refresh:', dbError);
    }

    const allRecords = [currentRecord, ...historicalRecords];
    cache.set('bridge-status', makeCacheEntry(allRecords, trafficData), 600, 300);

    console.log('Background refresh completed');
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
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
        directions: cacheResult.data.trafficData.directions,
        overallStatus: cacheResult.data.trafficData.overallStatus,
      });
    }

    if (cacheResult.data && cacheResult.isStale) {
      refreshBridgeData().catch(console.error);

      return jsonNoStore({
        success: true,
        data: cacheResult.data.records,
        cached: true,
        stale: true,
        timestamp: cacheResult.data.timestamp,
        trafficData: cacheResult.data.trafficData,
        directions: cacheResult.data.trafficData.directions,
        overallStatus: cacheResult.data.trafficData.overallStatus,
      });
    }

    const trafficData = await getBridgeTrafficData();
    const currentRecord = buildCurrentRecord(trafficData);

    let historicalRecords: BridgeStatusRecord[] = [];
    try {
      historicalRecords = await saveCurrentRecord(currentRecord);
    } catch (dbError) {
      console.error('MongoDB error while saving bridge status:', dbError);
    }

    const allRecords = [currentRecord, ...historicalRecords];
    const cacheEntry = makeCacheEntry(allRecords, trafficData);
    cache.set('bridge-status', cacheEntry, 600, 300);

    return jsonNoStore({
      success: true,
      data: allRecords,
      realTime: true,
      timestamp: trafficData.timestamp,
      directions: trafficData.directions,
      overallStatus: trafficData.overallStatus,
      trafficData: cacheEntry.trafficData,
    });
  } catch (error) {
    console.error('Failed to fetch real traffic data:', error);

    const cachedData = cache.get<BridgeCacheEntry>('bridge-status');
    if (cachedData) {
      return jsonNoStore({
        success: true,
        data: cachedData.records,
        fallback: true,
        cached: true,
        timestamp: cachedData.timestamp,
        trafficData: cachedData.trafficData,
        directions: cachedData.trafficData.directions,
        overallStatus: cachedData.trafficData.overallStatus,
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
