import axios, { type AxiosResponse } from 'axios';
import { crossingDirection } from './bridge';
import type { DirectionalStatus, TrafficData } from './traffic';

// Official DATEX II v3.4 schema: developer.data.nationalhighways.co.uk/api-details#api=road-and-lane-closures-v2
const ENDPOINT = 'https://api.data.nationalhighways.co.uk/roads/v2.0/closures';
type Location = {
  locLinearLocation?: { gmlLineString?: { locGmlLineString?: { posList?: string; srsDimension?: number; srsName?: string } } };
  locSingleRoadLinearLocation?: { linearWithinLinearElement?: Array<{ directionOnLinearSection?: string }> };
};
type RecordData = {
  roadOrCarriagewayOrLaneManagementType?: { value?: string };
  validity?: { validityStatus?: string; validityTimeSpecification?: { overallStartTime?: string; overallEndTime?: string } };
  locationReference?: Location & { locLocationGroupByList?: { locationContainedInGroup?: Location[] } };
};
type Payload = { D2Payload?: { publicationTime?: string; situation?: Array<{ situationRecord?: Array<{ sitRoadOrCarriagewayOrLaneManagement?: RecordData }> }> } };

export function parseClosures(data: Payload, now = Date.now()): DirectionalStatus {
  const unknown: TrafficData = { status: 'UNKNOWN', details: 'National Highways: No confirmed restriction found; open status not established', averageSpeed: null, description: 'National Highways' };
  const result: DirectionalStatus = { eastbound: { ...unknown }, westbound: { ...unknown } };
  const payload = data?.D2Payload;
  const age = now - Date.parse(payload?.publicationTime ?? '');
  if (!Array.isArray(payload?.situation) || !Number.isFinite(age) || age < -60000 || age > 900000) {
    throw new Error('National Highways response missing current publication data');
  }
  for (const situation of payload.situation) {
    if (!Array.isArray(situation?.situationRecord)) continue;
    for (const entry of situation.situationRecord) {
      const record = entry?.sitRoadOrCarriagewayOrLaneManagement;
      const period = record?.validity?.validityTimeSpecification;
      const start = Date.parse(period?.overallStartTime ?? '');
      const end = period?.overallEndTime === undefined ? Infinity : Date.parse(period.overallEndTime);
      // Completed records can remain 'active' in this feed for seven days.
      if (record?.validity?.validityStatus !== 'active' || !Number.isFinite(start) || start > now || !(end > now)) continue;
      const kind = record.roadOrCarriagewayOrLaneManagementType?.value;
      const status = kind === 'roadClosed' || kind === 'carriagewayClosures' ? 'CLOSED' : kind === 'laneClosures' ? 'DELAYED' : null;
      if (!status || !record.locationReference) continue;
      const ref = record.locationReference;
      const locations = ref.locLocationGroupByList?.locationContainedInGroup ?? [ref];
      if (!Array.isArray(locations)) continue;
      for (const location of locations) {
        const line = location?.locLinearLocation?.gmlLineString?.locGmlLineString;
        const dimensions = line?.srsDimension ?? 2;
        if (typeof line?.posList !== 'string' || ![2, 3].includes(dimensions)) continue;
        if (line.srsName && !/4258|4326|ETRS89|WGS84/i.test(line.srsName)) continue;
        const numbers = line.posList.trim().split(/\s+/).map(Number);
        if (numbers.length % dimensions || !numbers.every(Number.isFinite)) continue;
        const points = [];
        for (let i = 0; i < numbers.length; i += dimensions) points.push({ lat: numbers[i], lng: numbers[i + 1] });
        if (!crossingDirection(points)) continue;
        const sections = location.locSingleRoadLinearLocation?.linearWithinLinearElement;
        if (!Array.isArray(sections)) continue;
        const directions = sections.map(section => section.directionOnLinearSection);
        for (const direction of ['eastbound', 'westbound'] as const) {
          const applies = directions.some(value => value === 'bothWays' || value === 'allDirections' || value === (direction === 'eastbound' ? 'eastBound' : 'westBound'));
          if (applies && result[direction].status !== 'CLOSED') result[direction] = {
            status, averageSpeed: null, description: 'National Highways',
            details: status === 'CLOSED' ? 'National Highways reports a carriageway closure' : 'National Highways reports a lane restriction',
          };
        }
      }
    }
  }
  return result;
}

export async function getNationalHighwaysData(): Promise<DirectionalStatus> {
  const now = new Date();
  const signal = AbortSignal.timeout(20000);
  const responses = await Promise.allSettled(['planned', 'unplanned'].map(async closureType => {
    let next: string | null = null;
    let combined: DirectionalStatus | null = null;
    for (let page = 0; page < 20; page++) {
      const response: AxiosResponse<Payload> = await axios.get<Payload>(next ?? ENDPOINT, {
        headers: { 'Ocp-Apim-Subscription-Key': process.env.NATIONAL_HIGHWAYS_API_KEY, 'X-Response-MediaType': 'application/json' },
        params: next ? undefined : { closureType, startDateTime: now.toISOString().slice(0, 19), endDateTime: now.toISOString().slice(0, 19) },
        timeout: 8000, maxRedirects: 0, signal,
      });
      const parsed = parseClosures(response.data);
      if (!combined) combined = parsed;
      else for (const direction of ['eastbound', 'westbound'] as const) {
        if (parsed[direction].status === 'CLOSED' || combined[direction].status === 'UNKNOWN') combined[direction] = parsed[direction];
      }
      const header = response.headers['x-next'];
      if (!header) return combined;
      const url = new URL(String(header), ENDPOINT);
      // Never forward the subscription key to a host supplied by a response.
      if (url.origin !== new URL(ENDPOINT).origin || url.pathname !== new URL(ENDPOINT).pathname) throw new Error('Invalid National Highways pagination URL');
      next = url.href;
    }
    throw new Error('National Highways pagination limit exceeded');
  }));
  const results = responses.flatMap(response => response.status === 'fulfilled' ? [response.value] : []);
  if (!results.length) throw new Error('National Highways data unavailable');
  const result = results[0];
  for (const direction of ['eastbound', 'westbound'] as const) {
    if (results[1] && (results[1][direction].status === 'CLOSED' || result[direction].status === 'UNKNOWN')) result[direction] = results[1][direction];
  }
  return result;
}

