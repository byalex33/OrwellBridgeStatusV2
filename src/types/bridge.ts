export interface BridgeStatusRecord {
  _id: string;
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  timestamp: string;
  description: string;
  direction: 'both' | 'north' | 'south' | 'eastbound' | 'westbound';
  averageSpeed: number | null;
  /** Missing on legacy records whose measurement unit is unknown. */
  speedUnit?: 'mph';
  directions?: TrafficDirections;
  __v: number;
}

export interface DirectionalTrafficData {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
  averageSpeed: number | null;
  description: string;
}

export interface TrafficDirections {
  eastbound: DirectionalTrafficData;
  westbound: DirectionalTrafficData;
}

export interface OverallTrafficStatus {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
}

export interface BridgeStatusResponse {
  success: boolean;
  data: BridgeStatusRecord[];
  realTime?: boolean;
  cached?: boolean;
  fallback?: boolean;
  stale?: boolean;
  error?: string;
  timestamp?: string;
  trafficData?: {
    directions: TrafficDirections;
    overallStatus: OverallTrafficStatus;
  };
}

// Forecast gusts against National Highways' Orwell Bridge high-wind thresholds.
export interface WindWarning {
  level: 'limit' | 'closure';
  peakGust: number;
  from: string;
  until: string;
}

export interface GustForecast {
  peak: number;
  at: string;
}

export interface DirectionPattern {
  typical: number | null;
  samples: number;
  // Average mph by Europe/London hour (0-23) and weekday (Mon-Sun); null where data is too thin.
  byHour: Array<number | null>;
  byDay: Array<number | null>;
  slowestHour: { hour: number; speed: number } | null;
  slowestDay: { day: string; speed: number } | null;
}

export interface TrafficPatterns {
  since: string | null;
  days: number;
  directions: { eastbound: DirectionPattern; westbound: DirectionPattern };
}

export interface WeatherResponse {
  success: boolean;
  data: {
    timestamp: string;
    temperature: number;
    windSpeed: number;
    windDirection: number;
    description: string;
    icon: string;
    windGust?: number;
    gustForecast?: GustForecast;
    // null: no high winds forecast; absent: gust forecast unavailable.
    windWarning?: WindWarning | null;
  } | null;
  realTime?: boolean;
  cached?: boolean;
  fallback?: boolean;
}

