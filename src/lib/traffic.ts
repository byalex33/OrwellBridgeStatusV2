import { getNationalHighwaysData } from './national-highways';
import { getMapboxTrafficData } from './mapbox';
import { consensusDirection } from './consensus';

export interface TrafficData {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
  averageSpeed: number | null;
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

export class TrafficDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrafficDataUnavailableError';
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

export async function getBridgeTrafficData() {
  const results = await Promise.allSettled([
    process.env.NATIONAL_HIGHWAYS_API_KEY ? getNationalHighwaysData() : Promise.resolve(null),
    process.env.MAPBOX_ACCESS_TOKEN ? getMapboxTrafficData() : Promise.resolve(null),
  ]);
  const sources = results.map(result => result.status === 'fulfilled' ? result.value : null);
  const directions = {
    eastbound: consensusDirection(...sources.map(source => source?.eastbound ?? null)),
    westbound: consensusDirection(...sources.map(source => source?.westbound ?? null)),
  };
  if (directions.eastbound.status === 'UNKNOWN' && directions.westbound.status === 'UNKNOWN') {
    throw new TrafficDataUnavailableError('All configured traffic sources are unavailable');
  }
  return { directions, overallStatus: determineOverallStatus(directions), timestamp: new Date() };
}
