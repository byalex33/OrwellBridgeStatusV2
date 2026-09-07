"use client";

import {
  Thermometer, Wind, ArrowUp, Clock, AlertTriangle, Gauge, Heart, Coffee,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { BridgeStatusRecord, BridgeStatusResponse, WeatherResponse, TrafficDirections } from "@/types/bridge";

type LaneStatus = "open" | "delayed" | "closed" | "unknown";
type DataFreshness = "loading" | "live" | "cached" | "stale" | "fallback" | "error";

interface BridgeStatus {
  eastbound: LaneStatus;
  westbound: LaneStatus;
  lastUpdated: string;
  observedAt?: string;
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

function WeatherIcon({ description, className }: { description: string; className?: string }) {
  const d = description.toLowerCase();
  if (d.includes("thunder")) return <CloudLightning className={className} />;
  if (d.includes("snow")) return <CloudSnow className={className} />;
  if (d.includes("rain") || d.includes("shower")) return <CloudRain className={className} />;
  if (d.includes("drizzle")) return <CloudDrizzle className={className} />;
  if (d.includes("cloud") || d.includes("overcast") || d.includes("fog")) return <Cloud className={className} />;
  return <Sun className={className} />;
}

export default function Home() {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({
    eastbound: "unknown",
    westbound: "unknown",
    lastUpdated: "Loading...",
    isRealTime: false,
    freshness: "loading",
  });

  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    windSpeed: 0,
    windDirection: 0,
    description: "Loading...",
    icon: "",
  });

  const [pastEvents, setPastEvents] = useState<BridgeStatusRecord[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficDirections | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function request(path: string) {
      const response = await fetch(path, {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const result = await response.json();
      if (controller.signal.aborted) throw new Error("Request cancelled");
      return { response, result };
    }
    const fetchBridgeStatusHistory = async () => {
      if (running) return;
      running = true;
      await Promise.allSettled([
        request("/api/bridge-status").then(({ response: bridgeResponse, result: bridgeResult }: { response: Response; result: BridgeStatusResponse }) => {
        if (bridgeResponse.ok && bridgeResult?.success) {
          const apiTimestamp = bridgeResult.timestamp || bridgeResult.data[0]?.timestamp;
          const lastUpdated = apiTimestamp
            ? new Date(apiTimestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
            : "Unknown";
          const freshness: DataFreshness = bridgeResult.fallback
            ? "fallback"
            : bridgeResult.stale
            ? "stale"
            : bridgeResult.cached
            ? "cached"
            : bridgeResult.realTime
            ? "live"
            : "cached";

          const age = apiTimestamp ? Date.now() - new Date(apiTimestamp).getTime() : NaN;
          if (bridgeResult.trafficData && (!Number.isFinite(age) || age > 600000 || age < -60000 || bridgeResult.stale || bridgeResult.fallback)) {
            setBridgeStatus(prev => ({ ...prev, eastbound: "unknown", westbound: "unknown", lastUpdated, isRealTime: false, freshness: bridgeResult.fallback ? "fallback" : "stale" }));
            setTrafficData(null);
          } else if (bridgeResult.trafficData) {
            const { directions } = bridgeResult.trafficData;
            setBridgeStatus((prev) => ({
              ...prev,
              eastbound: directions.eastbound.status.toLowerCase() as LaneStatus,
              westbound: directions.westbound.status.toLowerCase() as LaneStatus,
              lastUpdated,
              observedAt: apiTimestamp,
              isRealTime: freshness === "live",
              freshness,
            }));
            setTrafficData(directions);
          } else {
            // A historical event cannot establish current directional observations.
            setBridgeStatus(prev => ({ ...prev, eastbound: "unknown", westbound: "unknown", lastUpdated, isRealTime: false, freshness: "fallback" }));
            setTrafficData(null);
          }
        } else {
          setBridgeStatus((prev) => ({
            ...prev,
            eastbound: "unknown",
            westbound: "unknown",
            lastUpdated: "Unavailable",
            isRealTime: false,
            freshness: "error",
          }));
          setTrafficData(null);
        }

        }).catch(() => {
          if (!controller.signal.aborted) {
            setBridgeStatus(prev => ({ ...prev, eastbound: "unknown", westbound: "unknown", lastUpdated: "Unavailable", isRealTime: false, freshness: "error" }));
            setTrafficData(null);
          }
        }),
        request("/api/weather").then(({ result: weatherResult }: { result: WeatherResponse }) => {
          if (weatherResult?.data) setWeather(weatherResult.data);
        }),
        request("/api/events").then(({ response, result }) => {
          if (response.ok && Array.isArray(result)) setPastEvents(result);
          else setPastEvents([]);
        }).catch(() => {
          if (!controller.signal.aborted) setPastEvents([]);
        }).finally(() => {
          if (!controller.signal.aborted) setEventsLoading(false);
        }),
      ]);
      running = false;
    };

    void fetchBridgeStatusHistory();
    const interval = setInterval(() => void fetchBridgeStatusHistory(), 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void fetchBridgeStatusHistory(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBridgeStatus(prev => {
        const age = prev.observedAt ? Date.now() - new Date(prev.observedAt).getTime() : NaN;
        return (prev.freshness === "live" || prev.freshness === "cached") && (!Number.isFinite(age) || age > 600000 || age < -60000)
          ? { ...prev, eastbound: "unknown", westbound: "unknown", isRealTime: false, freshness: "stale" } : prev;
      });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: LaneStatus) => {
    switch (status) {
      case "open": return "text-emerald-400";
      case "delayed": return "text-amber-400";
      case "closed": return "text-rose-400";
      default: return "text-zinc-500";
    }
  };

  const getStatusBorder = (status: LaneStatus) => {
    switch (status) {
      case "open": return "border-emerald-500/25 bg-emerald-500/5";
      case "delayed": return "border-amber-500/25 bg-amber-500/5";
      case "closed": return "border-rose-500/25 bg-rose-500/5";
      default: return "border-border/60 bg-card";
    }
  };

  const getDotColor = (status: LaneStatus) => {
    switch (status) {
      case "open": return "bg-emerald-400";
      case "delayed": return "bg-amber-400";
      case "closed": return "bg-rose-400";
      default: return "bg-zinc-600";
    }
  };

  const getStatusText = (status: LaneStatus) => {
    switch (status) {
      case "open": return "Open";
      case "delayed": return "Delays";
      case "closed": return "Closed";
      default: return "Unknown";
    }
  };

  const getWindDirection = (degrees: number) => {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(degrees / 22.5) % 16];
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString("en-GB"),
      time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getEventDot = (status: string) => {
    switch (status.toLowerCase()) {
      case "open": return "bg-emerald-400";
      case "delayed": return "bg-amber-400";
      case "closed": return "bg-rose-400";
      default: return "bg-zinc-500";
    }
  };

  const getFreshnessLabel = (freshness: DataFreshness) => {
    switch (freshness) {
      case "live": return "Live";
      case "cached": return "Cached";
      case "stale": return "Stale";
      case "fallback": return "Fallback";
      case "error": return "Error";
      default: return "Connecting";
    }
  };

  const isWarning = bridgeStatus.freshness === "stale" || bridgeStatus.freshness === "fallback" || bridgeStatus.freshness === "error";

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight">Orwell Bridge</h1>
            <p className="text-xs text-muted-foreground">A14 · Ipswich ↔ Felixstowe</p>
          </div>
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border font-medium ${
            bridgeStatus.freshness === "live"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : isWarning
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-border/60 bg-muted/20 text-muted-foreground"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              bridgeStatus.freshness === "live"
                ? "bg-emerald-400 animate-pulse"
                : isWarning
                ? "bg-amber-400"
                : "bg-zinc-600"
            }`} />
            {bridgeStatus.freshness === "loading"
              ? "Connecting..."
              : `${getFreshnessLabel(bridgeStatus.freshness)} · ${bridgeStatus.lastUpdated}`}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-5">

        <button type="button" className="text-sm underline" onClick={() => setRefresh(value => value + 1)}>Refresh status</button>
        {/* Staleness / error warning */}
        {isWarning && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/8 text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
            <p className="text-sm leading-relaxed">
              {bridgeStatus.freshness === "error"
                ? "Could not refresh live data. Check official travel sources before travelling."
                : "Status not freshly confirmed. Check official travel sources before travelling."}
            </p>
          </div>
        )}

        {/* Bridge direction status */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Current Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                { direction: "Eastbound", route: "Ipswich → Felixstowe", status: bridgeStatus.eastbound, traffic: isWarning ? undefined : trafficData?.eastbound },
                { direction: "Westbound", route: "Felixstowe → Ipswich", status: bridgeStatus.westbound, traffic: isWarning ? undefined : trafficData?.westbound },
              ] as const
            ).map(({ direction, route, status, traffic }) => (
              <div key={direction} className={`rounded-2xl border p-6 ${getStatusBorder(status)}`}>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {direction}
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5">{route}</div>
                  </div>
                  {traffic?.averageSpeed != null && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      <Gauge className="h-3.5 w-3.5" />
                      {traffic.averageSpeed} mph
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotColor(status)}`} />
                  <span className={`text-4xl font-bold tracking-tight ${getStatusColor(status)}`}>
                    {getStatusText(status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delay detail banners */}
        {bridgeStatus.eastbound === "delayed" && trafficData?.eastbound?.details && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200/90">
            <Clock className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-medium text-amber-400">Eastbound · </span>
              {trafficData.eastbound.details}
            </p>
          </div>
        )}
        {bridgeStatus.westbound === "delayed" && trafficData?.westbound?.details && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200/90">
            <Clock className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
            <p className="text-sm">
              <span className="font-medium text-amber-400">Westbound · </span>
              {trafficData.westbound.details}
            </p>
          </div>
        )}

        {/* Weather */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Weather
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                <Thermometer className="h-3.5 w-3.5" />
                <span className="text-xs">Temperature</span>
              </div>
              <div>
                <span className="text-3xl font-mono font-semibold">{weather.temperature}</span>
                <span className="text-lg text-muted-foreground ml-0.5">°C</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                <Wind className="h-3.5 w-3.5" />
                <span className="text-xs">Wind Speed</span>
              </div>
              <div>
                <span className="text-3xl font-mono font-semibold">{weather.windSpeed}</span>
                <span className="text-base text-muted-foreground ml-1">mph</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
                <ArrowUp
                  className="h-3.5 w-3.5 transition-transform"
                  style={{ transform: `rotate(${weather.windDirection}deg)` }}
                />
                <span className="text-xs">Direction</span>
              </div>
              <span className="text-3xl font-mono font-semibold">{getWindDirection(weather.windDirection)}</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-sm text-muted-foreground px-1">
            <WeatherIcon description={weather.description} className="h-4 w-4" />
            <span>{weather.description}</span>
          </div>
          {weather.windSpeed > 30 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/25 bg-amber-500/8 text-amber-200 mt-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
              <p className="text-sm">High wind warning — bridge may be restricted for high-sided vehicles</p>
            </div>
          )}
        </div>

        {/* Past Events */}
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Past Events
          </h2>
          {eventsLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground text-sm rounded-xl border border-border/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading events...
            </div>
          ) : pastEvents.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm rounded-xl border border-border/50">
              No recent events found
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
              {pastEvents.slice(0, 5).map((record) => {
                const { date, time } = formatTimestamp(record.timestamp);
                return (
                  <div
                    key={record._id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getEventDot(record.status)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{record.description}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
                      {record.averageSpeed != null && (
                        <div className="flex items-center gap-1 font-mono">
                          <Gauge className="h-3 w-3" />
                          {record.averageSpeed}
                        </div>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-muted/60">{record.direction}</span>
                      <span className="font-mono opacity-60">{date} {time}</span>
                    </div>
                  </div>
                );
              })}
              {pastEvents.length > 5 && (
                <div className="px-4 py-3 text-center text-xs text-muted-foreground/60">
                  Showing 5 of {pastEvents.length} events
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-8 mt-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Created with <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400 mx-0.5" /> by Alex
          </div>
          <p className="text-xs text-muted-foreground/50">Data: TomTom Traffic API · Open-Meteo</p>
          <a
            href="https://ko-fi.com/alexbaldry"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 hover:border-zinc-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Coffee className="h-4 w-4" />
            Buy me a Red Bull
          </a>
        </div>
      </footer>
    </div>
  );
}

