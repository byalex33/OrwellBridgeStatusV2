export interface BridgeStatusRecord {
  _id: string;
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  timestamp: string;
  description: string;
  direction: 'both' | 'north' | 'south' | 'eastbound' | 'westbound';
  averageSpeed: number;
  __v: number;
}

export interface DirectionalTrafficData {
  status: 'OPEN' | 'DELAYED' | 'CLOSED' | 'UNKNOWN';
  details: string;
  averageSpeed: number;
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

export interface WeatherResponse {
  success: boolean;
  data: {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    description: string;
    icon: string;
  };
  realTime?: boolean;
  cached?: boolean;
  fallback?: boolean;
}