export type Point = { lat: number; lng: number };

// ponytail: a cross-section of this straight bridge; use road-link matching if coverage expands.
export function crossingDirection(points: Point[]): 'eastbound' | 'westbound' | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!a || typeof a !== 'object' || !b || typeof b !== 'object') continue;
    if (![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite) || a.lng === b.lng) continue;
    const fraction = (1.166 - a.lng) / (b.lng - a.lng);
    const latitude = a.lat + fraction * (b.lat - a.lat);
    if (fraction >= 0 && fraction <= 1 && latitude >= 52.0267 && latitude <= 52.0272) {
      return b.lng > a.lng ? 'eastbound' : 'westbound';
    }
  }
  return null;
}

