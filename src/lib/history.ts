import type { MongoClient } from 'mongodb';
import type { BridgeStatusRecord, TrafficDirections } from '@/types/bridge';
import type { DbBridgeRecord } from './records';

export async function saveBridgeTransition(client: MongoClient, current: BridgeStatusRecord, directions: TrafficDirections): Promise<void> {
  const db = client.db('paststatus');
  const collection = db.collection<DbBridgeRecord>('bridgeevents');
  const lock = db.collection<{ _id: string; revision: number }>('bridgehistorystate');
  try {
    await lock.updateOne({ _id: 'history' }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
  }
  // MongoDB Atlas/replica-set transactions serialize writers on this shared document.
  await client.withSession(session => session.withTransaction(async () => {
    await lock.updateOne({ _id: 'history' }, { $inc: { revision: 1 } }, { session });
    const [last] = await collection.aggregate<DbBridgeRecord>([
      { $set: { timestamp: { $convert: { input: '$timestamp', to: 'date', onError: null, onNull: null } } } },
      { $match: { timestamp: { $ne: null } } },
      { $sort: { timestamp: -1, _id: -1 } },
      { $limit: 1 },
    ], { session }).toArray();
    const eastboundStatus = directions.eastbound.status;
    const westboundStatus = directions.westbound.status;
    if (last && new Date(current.timestamp) < new Date(last.timestamp!)) return;
    if (last?.eastboundStatus === eastboundStatus && last?.westboundStatus === westboundStatus) return;
    await collection.insertOne({
      status: current.status, timestamp: new Date(current.timestamp), description: current.description,
      direction: current.direction, averageSpeed: current.averageSpeed, speedUnit: current.speedUnit, eastboundStatus, westboundStatus,
    }, { session });
  }, { timeoutMS: 2000, writeConcern: { w: 'majority' } }));
}
