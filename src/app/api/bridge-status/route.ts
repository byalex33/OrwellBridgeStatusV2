import { NextResponse } from 'next/server';
import { BridgeStatusRecord } from '@/types/bridge';
import { getBridgeTrafficData } from '@/lib/traffic';
import { cache } from '@/lib/cache';

const mockData: BridgeStatusRecord[] = [
  {
    _id: '675b867d1263d7b19b12ebb2',
    status: 'OPEN',
    timestamp: new Date().toISOString(),
    description: 'Bridge is fully open in both directions',
    direction: 'both',
    averageSpeed: 34.5,
    __v: 0,
  },
  {
    _id: '675b867d1263d7b19b12ebb1',
    status: 'DELAYED',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    description: 'Bridge is experiencing delays in at least one direction',
    direction: 'both',
    averageSpeed: 28.2,
    __v: 0,
  },
  {
    _id: '675b867d1263d7b19b12ebb0',
    status: 'OPEN',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    description: 'Bridge reopened after maintenance',
    direction: 'both',
    averageSpeed: 32.8,
    __v: 0,
  },
];

async function refreshBridgeData() {
  try {
    const trafficData = await getBridgeTrafficData();

    const currentRecord: BridgeStatusRecord = {
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

    let historicalRecords: BridgeStatusRecord[] = [];
    try {
      const clientPromise = import('@/lib/mongodb').then(m => m.default);
      const client = await clientPromise;
      const db = client.db('paststatus');
      const collection = db.collection('bridgeevents');

      await collection.insertOne({
        status: currentRecord.status,
        timestamp: new Date(currentRecord.timestamp),
        description: currentRecord.description,
        direction: currentRecord.direction,
        averageSpeed: currentRecord.averageSpeed,
      });

      const records = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(19)
        .toArray();

      historicalRecords = records.map((record) => ({
        _id: record._id.toString(),
        status: record.status,
        timestamp: record.timestamp.toISOString(),
        description: record.description,
        direction: record.direction,
        averageSpeed: record.averageSpeed,
        __v: record.__v || 0,
      }));
    } catch (dbError) {
      console.error('MongoDB error during background refresh:', dbError);
      historicalRecords = mockData.slice(1);
    }

    const allRecords = [currentRecord, ...historicalRecords];

    cache.set('bridge-status', {
      records: allRecords,
      timestamp: trafficData.timestamp,
      trafficData: {
        directions: trafficData.directions,
        overallStatus: trafficData.overallStatus
      }
    }, 600, 300);

    console.log('Background refresh completed');
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}

export async function GET() {
  try {
    const cacheResult = cache.getWithStale<{records: BridgeStatusRecord[], timestamp: Date, trafficData: { directions: unknown; overallStatus: unknown }}>('bridge-status');

    if (cacheResult.data && !cacheResult.isStale) {
      return NextResponse.json({
        success: true,
        data: cacheResult.data.records,
        cached: true,
        timestamp: cacheResult.data.timestamp,
        trafficData: cacheResult.data.trafficData,
        directions: cacheResult.data.trafficData?.directions,
        overallStatus: cacheResult.data.trafficData?.overallStatus
      });
    }

    if (cacheResult.data && cacheResult.isStale) {
      const staleResponse = NextResponse.json({
        success: true,
        data: cacheResult.data.records,
        cached: true,
        stale: true,
        timestamp: cacheResult.data.timestamp,
        trafficData: cacheResult.data.trafficData,
        directions: cacheResult.data.trafficData?.directions,
        overallStatus: cacheResult.data.trafficData?.overallStatus
      });

      refreshBridgeData().catch(console.error);

      return staleResponse;
    }

    const trafficData = await getBridgeTrafficData();

    const currentRecord: BridgeStatusRecord = {
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

    let historicalRecords: BridgeStatusRecord[] = [];
    try {
      const clientPromise = import('@/lib/mongodb').then(m => m.default);
      const client = await clientPromise;
      const db = client.db('paststatus');
      const collection = db.collection('bridgeevents');

      console.log('Saving current status to MongoDB:', currentRecord.status);
      const insertResult = await collection.insertOne({
        status: currentRecord.status,
        timestamp: new Date(currentRecord.timestamp),
        description: currentRecord.description,
        direction: currentRecord.direction,
        averageSpeed: currentRecord.averageSpeed,
      });
      console.log('MongoDB insert result:', insertResult.insertedId);

      const records = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(19)
        .toArray();

      historicalRecords = records.map((record) => ({
        _id: record._id.toString(),
        status: record.status,
        timestamp: record.timestamp.toISOString(),
        description: record.description,
        direction: record.direction,
        averageSpeed: record.averageSpeed,
        __v: record.__v || 0,
      }));
    } catch (dbError) {
      console.error('MongoDB error, using limited historical data:', dbError);
      historicalRecords = mockData.slice(1);
    }

    const allRecords = [currentRecord, ...historicalRecords];

    cache.set('bridge-status', {
      records: allRecords,
      timestamp: trafficData.timestamp,
      trafficData: {
        directions: trafficData.directions,
        overallStatus: trafficData.overallStatus
      }
    }, 600, 300);

    return NextResponse.json({
      success: true,
      data: allRecords,
      realTime: true,
      timestamp: trafficData.timestamp,
      directions: trafficData.directions,
      overallStatus: trafficData.overallStatus,
      trafficData: {
        directions: trafficData.directions,
        overallStatus: trafficData.overallStatus
      }
    });

  } catch (error) {
    console.error('Failed to fetch real traffic data, using fallback:', error);

    const cachedData = cache.get<{records: BridgeStatusRecord[], timestamp: Date, trafficData: { directions: unknown; overallStatus: unknown }}>('bridge-status');
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData.records,
        fallback: true,
        cached: true,
        timestamp: cachedData.timestamp,
        trafficData: cachedData.trafficData,
        directions: cachedData.trafficData?.directions,
        overallStatus: cachedData.trafficData?.overallStatus
      });
    }

    return NextResponse.json({
      success: true,
      data: mockData,
      fallback: true,
      error: 'Real-time data unavailable'
    });
  }
}