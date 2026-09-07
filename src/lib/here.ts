import axios from 'axios';
import { crossingDirection, type Point } from './bridge';

const HERE_FLOW_URL = 'https://data.traffic.hereapi.com/v7/flow';


export interface HereDirectionalStatus {
  eastbound: HereTrafficData;
  westbound: HereTrafficData;
}

export interface HereTrafficData {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
  averageSpeed: number;
  description: string;
}

interface HereFlowResult {
  location?: { shape?: { links?: Array<{ points?: Point[] }> } };
  currentFlow?: {
    speed?: number;
    freeFlow?: number;
    jamFactor?: number;
    traversability?: string;
    confidence?: number;
  };
}

interface HereResponse {
  sourceUpdated?: string;
  results?: HereFlowResult[];
}

export function analyzeHereFlow(results: HereFlowResult[]): Omit<HereTrafficData, 'description'> {
  const closed = results.some(r => r?.currentFlow?.traversability === 'closed' || r?.currentFlow?.jamFactor === 10);
  if (closed) return { status: 'CLOSED', details: 'HERE reports a road closure', averageSpeed: 0 };
  const valid = results.filter(r => typeof r?.currentFlow?.speed === 'number' &&
    Number.isFinite(r.currentFlow.speed) && r.currentFlow.speed >= 0 &&
    typeof r.currentFlow.jamFactor === 'number' && Number.isFinite(r.currentFlow.jamFactor) &&
    r.currentFlow.jamFactor >= 0 && r.currentFlow.jamFactor < 10 &&
    typeof r.currentFlow.confidence === 'number' && r.currentFlow.confidence > 0.7 && r.currentFlow.confidence <= 1);

  if (!valid.length) {
    return { status: 'UNKNOWN', details: 'No HERE flow data returned', averageSpeed: 0 };
  }

  const worstJam = Math.max(...valid.map(r => r?.currentFlow?.jamFactor ?? 0));
  const avgSpeedMs = valid.reduce((sum, r) => sum + (r?.currentFlow?.speed ?? 0), 0) / valid.length;
  const avgSpeedMph = Math.round(avgSpeedMs * 2.237);
  if (worstJam >= 4 || avgSpeedMs === 0) {
    return { status: 'DELAYED', details: 'HERE: Significant traffic delays detected', averageSpeed: avgSpeedMph };
  }
  return { status: 'OPEN', details: 'HERE: Normal traffic flow', averageSpeed: avgSpeedMph };
}

export async function getHereTrafficData(): Promise<HereDirectionalStatus> {
  const response = await axios.get<HereResponse>(HERE_FLOW_URL, {
    params: { locationReferencing: 'shape', in: 'bbox:1.155,52.0264,1.175,52.0274', apiKey: process.env.HERE_API_KEY },
    timeout: 8000,
  });
  const age = Date.now() - Date.parse(response.data?.sourceUpdated ?? '');
  if (!Array.isArray(response.data?.results) || !Number.isFinite(age) || age < -60000 || age > 600000) {
    throw new Error('HERE response missing current flow data');
  }
  const result = {} as HereDirectionalStatus;
  for (const direction of ['eastbound', 'westbound'] as const) {
    const flows = response.data.results.filter(flow => {
      const links = flow?.location?.shape?.links;
      if (!Array.isArray(links)) return false;
      const matched = new Set(links.map(link => Array.isArray(link?.points) ? crossingDirection(link.points) : null).filter(Boolean));
      return matched.size === 1 && matched.has(direction);
    });
    result[direction] = { ...analyzeHereFlow(flows), description: `A14 ${direction} (HERE)` };
  }
  return result;
}



