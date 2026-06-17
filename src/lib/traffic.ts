import axios from 'axios';

const BRIDGE_POINTS = {
  eastbound: {
    point: "52.0449,1.1700",
    description: "A14 Eastbound (Ipswich to Felixstowe)"
  },
  westbound: {
    point: "52.0452,1.1735",
    description: "A14 Westbound (Felixstowe to Ipswich)"
  }
};

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
    const averageSpeed = segment.currentSpeed || 0;
    const freeFlowSpeed = segment.freeFlowSpeed || 70;

    if (segment.roadClosure || averageSpeed === 0) {
      status = 'CLOSED';
      details = 'Bridge is currently closed to traffic';
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
      averageSpeed
    };
  } catch (error) {
    console.error('Error analyzing bridge status:', error);
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
      console.error(`Error fetching traffic data for ${direction}:`, error);
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
