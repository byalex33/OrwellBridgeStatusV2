import type { BridgeStatusRecord } from '@/types/bridge';

export type DbBridgeRecord = {
  _id?: { toString(): string };
  status?: string;
  timestamp?: Date | string;
  description?: string;
  direction?: string;
  averageSpeed?: number;
  speedUnit?: 'mph';
  __v?: number;
};

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

function normalizeTimestamp(timestamp: Date | string | undefined): string | null {
  if (timestamp instanceof Date) {
    return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
  }

  if (timestamp) {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export function mapBridgeRecord(record: DbBridgeRecord): BridgeStatusRecord | null {
  const timestamp = normalizeTimestamp(record.timestamp);
  if (!timestamp) return null;
  return {
    _id: record._id?.toString() || `record_${timestamp}`,
    status: normalizeStatus(record.status),
    timestamp: timestamp,
    description: record.description || 'No description available',
    direction: normalizeDirection(record.direction),
    averageSpeed: record.averageSpeed || 0,
    speedUnit: record.speedUnit === 'mph' ? 'mph' : undefined,
    __v: record.__v || 0,
  };
}

