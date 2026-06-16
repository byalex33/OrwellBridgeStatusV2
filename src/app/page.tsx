"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Thermometer, Wind, ArrowUp, Navigation, Clock, AlertTriangle, Gauge } from "lucide-react";
import { useState, useEffect } from "react";
import { BridgeStatusRecord, BridgeStatusResponse, WeatherResponse, TrafficDirections } from "@/types/bridge";

type LaneStatus = "open" | "delayed" | "closed" | "unknown";

type DataFreshness = "loading" | "live" | "cached" | "stale" | "fallback" | "error";

interface BridgeStatus {
  eastbound: LaneStatus;
  westbound: LaneStatus;
  lastUpdated: string;
  isRealTime: boolean;
  freshness: DataFreshness;
}

interface WeatherData {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
}


export default function Home() {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    eastbound: "unknown",
    westbound: "unknown",
    lastUpdated: "Loading...",
    isRealTime: false,
    freshness: "loading"
  });

  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    windSpeed: 0,
    windDirection: 0,
    description: "Loading...",
    icon: "⏳"
  });

  const [pastEvents, setPastEvents] = useState<BridgeStatusRecord[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficDirections | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    const fetchBridgeStatusHistory = async () => {
      try {
        const [bridgeResponse, weatherResponse, eventsResponse] = await Promise.all([
          fetch('/api/bridge-status'),
          fetch('/api/weather'),
          fetch('/api/events')
        ]);

        if (!bridgeResponse.ok || !weatherResponse.ok || !eventsResponse.ok) {
          throw new Error('One or more API requests failed');
        }

        const bridgeResult: BridgeStatusResponse = await bridgeResponse.json();
        const weatherResult: WeatherResponse = await weatherResponse.json();
        const eventsResult = await eventsResponse.json();

        if (bridgeResult.success) {
          const apiTimestamp = bridgeResult.timestamp || bridgeResult.data[0]?.timestamp;
          const lastUpdated = apiTimestamp
            ? new Date(apiTimestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            : 'Unknown';
          const freshness: DataFreshness = bridgeResult.fallback
            ? 'fallback'
            : bridgeResult.stale
              ? 'stale'
              : bridgeResult.cached
                ? 'cached'
                : bridgeResult.realTime
                  ? 'live'
                  : 'cached';

          if (bridgeResult.trafficData) {
            const { directions } = bridgeResult.trafficData;
            setBridgeStatus(prev => ({
              ...prev,
              eastbound: directions.eastbound.status.toLowerCase() as LaneStatus,
              westbound: directions.westbound.status.toLowerCase() as LaneStatus,
              lastUpdated,
              isRealTime: freshness === 'live',
              freshness
            }));
            setTrafficData(directions);
          } else if (bridgeResult.data.length > 0) {
            const latest = bridgeResult.data[0];
            const currentStatus = latest.status.toLowerCase() as LaneStatus;
            setBridgeStatus(prev => ({
              ...prev,
              eastbound: currentStatus,
              westbound: currentStatus,
              lastUpdated,
              isRealTime: false,
              freshness
            }));
          }
        }

        if (weatherResult.success) {
          setWeather(weatherResult.data);
        }

        // Handle events data - could be array of events or message object

        if (Array.isArray(eventsResult)) {
          setPastEvents(eventsResult);
        } else if (eventsResult && eventsResult.message) {
          setPastEvents([]);
        } else {
          setPastEvents([]);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setBridgeStatus(prev => ({
          ...prev,
          lastUpdated: 'Unavailable',
          isRealTime: false,
          freshness: 'error'
        }));
      } finally {
        setEventsLoading(false);
      }
    };

    fetchBridgeStatusHistory();

    const interval = setInterval(() => {
      fetchBridgeStatusHistory();
    }, 1800000); // 30 minutes like the original script

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: LaneStatus) => {
    switch (status) {
      case "open": return "bg-green-500";
      case "delayed": return "bg-yellow-500";
      case "closed": return "bg-red-500";
      case "unknown": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusText = (status: LaneStatus) => {
    switch (status) {
      case "open": return "Open";
      case "delayed": return "Delays";
      case "closed": return "Closed";
      case "unknown": return "Unknown";
      default: return "Unknown";
    }
  };

  const getWindDirection = (degrees: number) => {
    const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-GB'),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-green-500';
      case 'delayed': return 'bg-yellow-500';
      case 'closed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getFreshnessLabel = (freshness: DataFreshness) => {
    switch (freshness) {
      case 'live': return 'Live data';
      case 'cached': return 'Cached data';
      case 'stale': return 'Stale data — refreshing';
      case 'fallback': return 'Fallback data';
      case 'error': return 'Refresh failed';
      default: return 'Loading data';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center py-6">
          <h1 className="text-4xl font-bold text-foreground mb-2">Orwell Bridge Status</h1>
          <p className="text-muted-foreground">Live updates on bridge conditions and weather</p>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {bridgeStatus.lastUpdated}
          </p>
          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 border rounded-md ${
            bridgeStatus.freshness === 'live'
              ? 'bg-green-950/30 border-green-500 text-green-400'
              : bridgeStatus.freshness === 'stale' || bridgeStatus.freshness === 'fallback' || bridgeStatus.freshness === 'error'
                ? 'bg-yellow-950/30 border-yellow-500 text-yellow-300'
                : 'bg-slate-900 border-slate-600 text-slate-300'
          }`}>
            <span className="text-sm font-medium">• {getFreshnessLabel(bridgeStatus.freshness)}</span>
          </div>
        </header>

        {(bridgeStatus.freshness === 'stale' || bridgeStatus.freshness === 'fallback' || bridgeStatus.freshness === 'error') && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {bridgeStatus.freshness === 'error'
                ? 'We could not refresh live data. Please check official travel sources before travelling.'
                : 'This status is not freshly confirmed. Please check official travel sources before travelling.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="h-6 w-6" />
                  Bridge Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Eastbound (Ipswich to Felixstowe)</h3>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${getStatusColor(bridgeStatus.eastbound)}`}></div>
                      <Badge variant={bridgeStatus.eastbound === "open" ? "default" : bridgeStatus.eastbound === "delayed" ? "secondary" : "destructive"}>
                        {getStatusText(bridgeStatus.eastbound)}
                      </Badge>
                      {trafficData?.eastbound && (
                        <span className="text-sm text-muted-foreground">
                          {trafficData.eastbound.averageSpeed} mph
                        </span>
                      )}
                    </div>
                    {bridgeStatus.eastbound === "delayed" && trafficData?.eastbound && (
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          {trafficData.eastbound.details}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Westbound (Felixstowe to Ipswich)</h3>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${getStatusColor(bridgeStatus.westbound)}`}></div>
                      <Badge variant={bridgeStatus.westbound === "open" ? "default" : bridgeStatus.westbound === "delayed" ? "secondary" : "destructive"}>
                        {getStatusText(bridgeStatus.westbound)}
                      </Badge>
                      {trafficData?.westbound && (
                        <span className="text-sm text-muted-foreground">
                          {trafficData.westbound.averageSpeed} mph
                        </span>
                      )}
                    </div>
                    {bridgeStatus.westbound === "delayed" && trafficData?.westbound && (
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          {trafficData.westbound.details}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-6 w-6" />
                  Weather Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Conditions</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{weather.icon}</span>
                    <span className="text-sm">{weather.description}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Temperature</span>
                  <span className="text-2xl font-bold">{weather.temperature}°C</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Wind Speed</span>
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4" />
                    <span className="text-lg font-semibold">{weather.windSpeed} mph</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Wind Direction</span>
                  <div className="flex items-center gap-2">
                    <ArrowUp
                      className="h-4 w-4"
                      style={{ transform: `rotate(${weather.windDirection}deg)` }}
                    />
                    <span className="text-lg font-semibold">{getWindDirection(weather.windDirection)}</span>
                  </div>
                </div>

                {weather.windSpeed > 30 && (
                  <Alert className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      High wind warning - Bridge may be restricted for high-sided vehicles
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-6 w-6" />
                  Past Events
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[600px] overflow-y-auto">
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading past events...</div>
                  </div>
                ) : pastEvents.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">No recent events found</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pastEvents.slice(0, 5).map((record) => {
                      const { date, time } = formatTimestamp(record.timestamp);
                      return (
                        <div key={record._id} className="flex items-start gap-2 p-2 border rounded-md hover:bg-muted/50 transition-colors">
                          <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${getStatusIcon(record.status)}`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-1 flex-wrap">
                              <span className="font-medium text-xs">{date}</span>
                              <span className="text-xs text-muted-foreground">{time}</span>
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                                {record.status}
                              </Badge>
                              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                                {record.direction}
                              </Badge>
                              {record.averageSpeed && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Gauge className="h-2.5 w-2.5" />
                                  {record.averageSpeed}mph
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-foreground leading-tight truncate" title={record.description}>
                              {record.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {pastEvents.length > 5 && (
                      <div className="text-center pt-2">
                        <span className="text-xs text-muted-foreground">
                          Showing 5 most recent events
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>

        <footer className="mt-12 py-8 border-t border-border">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Created with ❤️ by Alex
            </p>
            <p className="text-xs text-muted-foreground">
              Data provided by TomTom Traffic API and Open-Meteo
            </p>
            <div className="flex justify-center">
              <a
                href="https://ko-fi.com/alexbaldry"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ☕ Buy me a Red Bull
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}