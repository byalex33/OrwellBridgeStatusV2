import axios from 'axios';
import { crossingDirection } from './bridge';
import type { DirectionalStatus, TrafficData } from './traffic';

const DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/';

// On-bridge nodes of OSM ways 3989499 (eastbound) and 5232026 (westbound); bearings pin each carriageway.
const ROUTES = {
  eastbound: { coordinates: '1.158345,52.026984;1.172439,52.027017', bearings: '90,30;90,30' },
  westbound: { coordinates: '1.172455,52.026917;1.158304,52.026886', bearings: '270,30;270,30' },
} as const;
const SPAN_METRES = 970;

type Congestion = 'low' | 'moderate' | 'heavy' | 'severe' | 'unknown';

interface MapboxLeg {
  annotation?: { distance?: number[]; congestion?: Congestion[] };
  closures?: unknown[];
  incidents?: Array<{ closed?: boolean }>;
}

interface MapboxRoute {
  distance?: number;
  duration?: number;
  duration_typical?: number;
  geometry?: { coordinates?: Array<[number, number]> };
  legs?: MapboxLeg[];
}

interface MapboxResponse {
  code?: string;
  message?: string;
  routes?: MapboxRoute[];
}

class MapboxRouteError extends Error {
  constructor(public detail: { code?: string; mapboxMessage?: string; routes?: number }) {
    super('Mapbox response missing route data');
    this.name = 'MapboxRouteError';
  }
}

// Mapbox explains a missing route (NoRoute, NoSegment, InvalidInput...) in code and message; HTTP errors carry them in the body.
function describeFailure(reason: unknown) {
  const body = (reason as { response?: { status?: number; data?: MapboxResponse } })?.response;
  const detail = { status: body?.status, code: body?.data?.code, mapboxMessage: body?.data?.message };
  return { message: reason instanceof Error ? reason.message : 'Unknown error', ...(reason instanceof MapboxRouteError ? reason.detail : detail) };
}

export function analyzeMapboxRoute(route: MapboxRoute | undefined, direction: 'eastbound' | 'westbound'): Omit<TrafficData, 'description'> {
  const unknown = (reason: string) => ({ status: 'UNKNOWN' as const, details: `Mapbox: ${reason}`, averageSpeed: null });
  const points = (route?.geometry?.coordinates ?? []).filter(Array.isArray).map(([lng, lat]) => ({ lat, lng }));
  // A route that detours or crosses the other way says nothing about this carriageway.
  if (crossingDirection(points) !== direction) return unknown('route did not cross the bridge in this direction');
  const legs = route?.legs ?? [];
  if (legs.some(leg => (leg?.closures?.length ?? 0) > 0 || leg?.incidents?.some(incident => incident?.closed === true))) {
    return { status: 'CLOSED', details: 'Mapbox reports a road closure', averageSpeed: null };
  }
  const { distance, duration, duration_typical: typical } = route ?? {};
  if (typeof distance !== 'number' || typeof duration !== 'number' || !(duration > 0) || !(distance > 0) || distance > SPAN_METRES * 2) return unknown('route distance or duration implausible');

  let measured = 0, congested = 0;
  for (const leg of legs) {
    const lengths = leg?.annotation?.distance ?? [];
    const levels = leg?.annotation?.congestion ?? [];
    lengths.forEach((length, i) => {
      if (!Number.isFinite(length) || !levels[i] || levels[i] === 'unknown') return;
      measured += length;
      if (levels[i] === 'heavy' || levels[i] === 'severe') congested += length;
    });
  }
  // Quiet periods have no live probes: the route still crosses and no closure is reported,
  // so report open without a speed rather than present a typical-speed estimate as live.
  if (measured < distance * 0.5) return { status: 'OPEN', details: 'Mapbox: No closures reported; no live speed data', averageSpeed: null };

  const averageSpeed = Math.round(distance / duration * 2.237);
  if (congested / measured >= 0.5 || (typeof typical === 'number' && typical > 0 && duration > typical * 2)) {
    return { status: 'DELAYED', details: 'Mapbox: Significant traffic delays detected', averageSpeed };
  }
  return { status: 'OPEN', details: 'Mapbox: Normal traffic flow', averageSpeed };
}

async function fetchDirection(direction: 'eastbound' | 'westbound'): Promise<TrafficData> {
  const { coordinates, bearings } = ROUTES[direction];
  const response = await axios.get<MapboxResponse>(DIRECTIONS_URL + coordinates, {
    params: {
      access_token: process.env.MAPBOX_ACCESS_TOKEN,
      annotations: 'distance,congestion,closure',
      overview: 'full',
      geometries: 'geojson',
      bearings,
      radiuses: '25;25',
    },
    timeout: 8000,
  });
  if (response.data?.code !== 'Ok' || !Array.isArray(response.data.routes)) {
    throw new MapboxRouteError({ code: response.data?.code, mapboxMessage: response.data?.message, routes: response.data?.routes?.length });
  }
  const result = analyzeMapboxRoute(response.data.routes[0], direction);
  if (result.status === 'UNKNOWN') console.warn('Mapbox reading unknown', { direction, reason: result.details });
  return { ...result, description: `A14 ${direction} (Mapbox)` };
}

export async function getMapboxTrafficData(): Promise<DirectionalStatus> {
  const [eastbound, westbound] = await Promise.allSettled([fetchDirection('eastbound'), fetchDirection('westbound')]);
  for (const [direction, result] of [['eastbound', eastbound], ['westbound', westbound]] as const) {
    if (result.status === 'rejected') console.warn('Mapbox request failed', { direction, ...describeFailure(result.reason) });
  }
  if (eastbound.status === 'rejected' && westbound.status === 'rejected') throw new Error('Mapbox traffic data unavailable');
  const failed = (direction: 'eastbound' | 'westbound'): TrafficData => ({ status: 'UNKNOWN', details: `Unable to fetch Mapbox data for ${direction}`, averageSpeed: null, description: `A14 ${direction} (Mapbox)` });
  return {
    eastbound: eastbound.status === 'fulfilled' ? eastbound.value : failed('eastbound'),
    westbound: westbound.status === 'fulfilled' ? westbound.value : failed('westbound'),
  };
}
