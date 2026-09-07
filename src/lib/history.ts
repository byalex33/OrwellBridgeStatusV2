import { createHash } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { BridgeStatusRecord, TrafficDirections } from '@/types/bridge';
import type { DbBridgeRecord } from './records';

export async function saveBridgeTransition(collection: Collection<DbBridgeRecord>, current: BridgeStatusRecord, directions: TrafficDirections): Promise<void> {
  const [last] = await collection.aggregate<DbBridgeRecord>([
    { $set: { timestamp: { $convert: { input: '$timestamp', to: 'date', onError: null, onNull: null } } } },
    { $match: { timestamp: { $ne: null } } },
    { $sort: { timestamp: -1, _id: -1 } },
    { $limit: 1 },
  ]).toArray();
  const eastboundStatus = directions.eastbound.status;
  const westboundStatus = directions.westbound.status;
  if (last && new Date(current.timestamp) < new Date(last.timestamp!)) return;
  if (last?.eastboundStatus === eastboundStatus && last?.westboundStatus === westboundStatus) return;

  // The previous transition and directional state identify one event across concurrent instances.
  const _id = createHash('sha256').update(JSON.stringify([last?._id?.toString() ?? null, eastboundStatus, westboundStatus])).digest('hex');
  try {
    await collection.insertOne({
      _id, status: current.status, timestamp: new Date(current.timestamp), description: current.description,
      direction: current.direction, averageSpeed: current.averageSpeed, eastboundStatus, westboundStatus,
    });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
  }
}
