import axios from 'axios';

import { BRIDGE_POINTS } from './bridge';

export interface TrafficData {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
  averageSpeed: number;
  description: string;
}

export interface DirectionalStatus {
  eastbound: TrafficData;
  westbound: TrafficData;
}

export interface OverallStatus {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
}

interface TomTomSegmentData {
  currentSpeed?: number;
  freeFlowSpeed?: number;
  roadClosure?: boolean;
}

interface TomTomResponse {
  flowSegmentData: TomTomSegmentData;
}

export class TrafficDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrafficDataUnavailableError';
  }
}

function validateCoordinates(point: string): boolean {
  const [lat, lon] = point.split(',').map(Number);
  return !isNaN(lat) && !isNaN(lon) &&
         lat >= -90 && lat <= 90 &&
         lon >= -180 && lon <= 180;
}

function analyzeBridgeStatus(trafficData: unknown): Omit<TrafficData, 'description'> {
  try {
    if (!trafficData || typeof trafficData !== 'object' || !('flowSegmentData' in trafficData)) {
      return {
        status: 'UNKNOWN',
        details: 'No traffic data available',
        averageSpeed: 0
      };
    }

    const segment = (trafficData as TomTomResponse).flowSegmentData;
    let status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
    let details: string;
    const averageSpeed = segment.currentSpeed;
    const freeFlowSpeed = segment.freeFlowSpeed;

    if (segment.roadClosure === true) {
      status = 'CLOSED';
      details = 'Bridge is currently closed to traffic';
    } else if (typeof averageSpeed !== 'number' || !Number.isFinite(averageSpeed) || averageSpeed < 0 ||
      typeof freeFlowSpeed !== 'number' || !Number.isFinite(freeFlowSpeed) || freeFlowSpeed <= 0) {
      return { status: 'UNKNOWN', details: 'TomTom speed data unavailable', averageSpeed: 0 };
    } else if (averageSpeed < freeFlowSpeed * 0.3) {
      status = 'DELAYED';
      details = 'Bridge is open but experiencing significant delays';
    } else {
      status = 'OPEN';
      details = 'Bridge is open with normal traffic flow';
    }

    return {
      status,
      details,
      averageSpeed: typeof averageSpeed === 'number' && Number.isFinite(averageSpeed) && averageSpeed >= 0 ? averageSpeed : 0
    };
  } catch (error) {
    console.error('Error analyzing bridge status', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return {
      status: 'UNKNOWN',
      details: 'Unable to determine bridge status',
      averageSpeed: 0
    };
  }
}

function determineOverallStatus(directionalStatus: DirectionalStatus): OverallStatus {
  if (directionalStatus.eastbound.status === 'CLOSED' ||
      directionalStatus.westbound.status === 'CLOSED') {
    return {
      status: 'CLOSED',
      details: 'Bridge is closed in at least one direction'
    };
  }

  if (directionalStatus.eastbound.status === 'DELAYED' ||
      directionalStatus.westbound.status === 'DELAYED') {
    return {
      status: 'DELAYED',
      details: 'Bridge is experiencing delays in at least one direction'
    };
  }

  if (directionalStatus.eastbound.status === 'UNKNOWN' ||
      directionalStatus.westbound.status === 'UNKNOWN') {
    return {
      status: 'UNKNOWN',
      details: 'Unable to determine bridge status'
    };
  }

  return {
    status: 'OPEN',
    details: 'Bridge is fully open in both directions'
  };
}

export async function getBridgeTrafficData(): Promise<{
  directions: DirectionalStatus;
  overallStatus: OverallStatus;
  timestamp: Date;
}> {
  if (!process.env.TOMTOM_API_KEY) {
    throw new TrafficDataUnavailableError('Missing TOMTOM_API_KEY environment variable');
  }

  const directions = ['eastbound', 'westbound'] as const;
  const directionalStatus = {} as DirectionalStatus;
  const failedDirections: string[] = [];

  for (const direction of directions) {
    const point = BRIDGE_POINTS[direction].point;
    if (!validateCoordinates(point)) {
      throw new Error(`Invalid coordinates for ${direction}`);
    }

    try {
      const trafficResponse = await axios.get(
        'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json',
        {
          params: {
            point: point,
            unit: 'mph',
            key: process.env.TOMTOM_API_KEY
          },
          timeout: 5000
        }
      );

      if (!trafficResponse.data?.flowSegmentData) {
        throw new Error('TomTom response did not include flowSegmentData');
      }

      directionalStatus[direction] = {
        ...analyzeBridgeStatus(trafficResponse.data),
        description: BRIDGE_POINTS[direction].description
      };
    } catch (error) {
      console.error(`Error fetching traffic data for ${direction}`, {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      failedDirections.push(direction);
      directionalStatus[direction] = {
        status: 'UNKNOWN',
        details: `Unable to fetch traffic data for ${direction} direction`,
        averageSpeed: 0,
        description: BRIDGE_POINTS[direction].description
      };
    }
  }

  if (failedDirections.length === directions.length) {
    throw new TrafficDataUnavailableError('Unable to fetch TomTom traffic data for either direction');
  }

  const overallStatus = determineOverallStatus(directionalStatus);

  return {
    directions: directionalStatus,
    overallStatus,
    timestamp: new Date()
  };
}



