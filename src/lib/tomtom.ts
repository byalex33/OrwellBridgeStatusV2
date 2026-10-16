import axios from 'axios';
import type { DirectionalStatus, TrafficData } from './traffic';

const FLOW_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json';

// A14 carriageways: https://www.openstreetmap.org/way/3989499 and /way/5232026
const POINTS = {
  eastbound: { point: '52.02701,1.166', description: 'A14 Eastbound (Ipswich to Felixstowe) (TomTom)' },
  westbound: { point: '52.02691,1.166', description: 'A14 Westbound (Felixstowe to Ipswich) (TomTom)' },
} as const;

interface TomTomResponse {
  flowSegmentData?: { currentSpeed?: number; freeFlowSpeed?: number; roadClosure?: boolean };
}

export function analyzeTomTomSegment(data: TomTomResponse | undefined): Omit<TrafficData, 'description'> {
  const segment = data?.flowSegmentData;
  if (!segment) return { status: 'UNKNOWN', details: 'TomTom: no traffic data available', averageSpeed: null };
  if (segment.roadClosure === true) return { status: 'CLOSED', details: 'TomTom reports a road closure', averageSpeed: null };
  const { currentSpeed: speed, freeFlowSpeed: freeFlow } = segment;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0 || typeof freeFlow !== 'number' || !Number.isFinite(freeFlow) || freeFlow <= 0) {
    return { status: 'UNKNOWN', details: 'TomTom speed data unavailable', averageSpeed: null };
  }
  if (speed < freeFlow * 0.3) return { status: 'DELAYED', details: 'TomTom: Significant traffic delays detected', averageSpeed: speed };
  return { status: 'OPEN', details: 'TomTom: Normal traffic flow', averageSpeed: speed };
}

async function fetchDirection(direction: 'eastbound' | 'westbound'): Promise<TrafficData> {
  const response = await axios.get<TomTomResponse>(FLOW_URL, {
    params: { point: POINTS[direction].point, unit: 'mph', key: process.env.TOMTOM_API_KEY },
    timeout: 5000,
  });
  if (!response.data?.flowSegmentData) throw new Error('TomTom response missing flowSegmentData');
  return { ...analyzeTomTomSegment(response.data), description: POINTS[direction].description };
}

export async function getTomTomTrafficData(): Promise<DirectionalStatus> {
  const [eastbound, westbound] = await Promise.allSettled([fetchDirection('eastbound'), fetchDirection('westbound')]);
  for (const [direction, result] of [['eastbound', eastbound], ['westbound', westbound]] as const) {
    if (result.status === 'rejected') {
      // The key travels in the query string, so log the status rather than the request.
      const status = (result.reason as { response?: { status?: number } })?.response?.status;
      console.warn('TomTom request failed', { direction, status, message: result.reason instanceof Error ? result.reason.message : 'Unknown error' });
    }
  }
  if (eastbound.status === 'rejected' && westbound.status === 'rejected') throw new Error('TomTom traffic data unavailable');
  const failed = (direction: 'eastbound' | 'westbound'): TrafficData => ({ status: 'UNKNOWN', details: `Unable to fetch TomTom data for ${direction}`, averageSpeed: null, description: POINTS[direction].description });
  return {
    eastbound: eastbound.status === 'fulfilled' ? eastbound.value : failed('eastbound'),
    westbound: westbound.status === 'fulfilled' ? westbound.value : failed('westbound'),
  };
}
