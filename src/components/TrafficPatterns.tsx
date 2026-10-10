"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { Clock } from "lucide-react";
import type { DirectionPattern, TrafficPatterns as Patterns } from "@/types/bridge";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WIDTH = 320, HEIGHT = 132, LEFT = 26, RIGHT = 8, TOP = 22, BOTTOM = 20;

const hourLabel = (hour: number) => hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;

function isPatterns(value: unknown): value is Patterns {
  const data = value as Patterns | null;
  const valid = (pattern: DirectionPattern | undefined) => !!pattern && Array.isArray(pattern.byHour) && pattern.byHour.length === 24 && Array.isArray(pattern.byDay) && pattern.byDay.length === 7;
  return !!data && Number.isFinite(data.days) && valid(data.directions?.eastbound) && valid(data.directions?.westbound);
}

function HourlyProfile({ pattern, label }: { pattern: DirectionPattern; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const known = pattern.byHour.filter((value): value is number => value !== null);
  // Lines may start above zero; the domain is padded to clean 5 mph steps.
  const min = Math.floor((Math.min(...known) - 2) / 5) * 5;
  const max = Math.ceil((Math.max(...known) + 2) / 5) * 5;
  const x = (hour: number) => LEFT + (hour / 23) * (WIDTH - LEFT - RIGHT);
  const y = (mph: number) => TOP + (1 - (mph - min) / (max - min)) * (HEIGHT - TOP - BOTTOM);
  const step = max - min <= 20 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);

  const segments: string[] = [];
  let current = "";
  pattern.byHour.forEach((mph, hour) => {
    if (mph === null) { if (current) segments.push(current); current = ""; return; }
    current += `${current ? "L" : "M"}${x(hour).toFixed(1)},${y(mph).toFixed(1)}`;
  });
  if (current) segments.push(current);

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const hour = Math.round(((event.clientX - box.left) / box.width * WIDTH - LEFT) / (WIDTH - LEFT - RIGHT) * 23);
    setActive(hour >= 0 && hour <= 23 && pattern.byHour[hour] !== null ? hour : null);
  };
  const slow = pattern.slowestHour && pattern.byHour[pattern.slowestHour.hour] != null ? pattern.slowestHour : null;
  const shown = active ?? null;
  const shownSpeed = shown !== null ? pattern.byHour[shown] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto touch-none select-none" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} aria-hidden="true">
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
            <text x={LEFT - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>{tick}</text>
          </g>
        ))}
        {[0, 6, 12, 18, 23].map(hour => (
          <text key={hour} x={x(hour)} y={HEIGHT - 4} textAnchor={hour === 0 ? "start" : hour === 23 ? "end" : "middle"} className="fill-muted-foreground font-mono" fontSize={10}>
            {hour === 23 ? "11pm" : hourLabel(hour)}
          </text>
        ))}
        {segments.map(path => <path key={path} d={path} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {slow && shown === null && (
          <g>
            <circle cx={x(slow.hour)} cy={y(slow.speed)} r={4} className="fill-foreground stroke-card" strokeWidth={2} />
            <text x={Math.min(Math.max(x(slow.hour), LEFT + 30), WIDTH - RIGHT - 30)} y={y(slow.speed) + 15} textAnchor="middle" className="fill-foreground" fontSize={11}>
              Slowest {hourLabel(slow.hour)}
            </text>
          </g>
        )}
        {shown !== null && shownSpeed !== null && (
          <g>
            <line x1={x(shown)} x2={x(shown)} y1={TOP - 4} y2={HEIGHT - BOTTOM} className="stroke-muted-foreground" strokeWidth={1} />
            <circle cx={x(shown)} cy={y(shownSpeed)} r={4} className="fill-foreground stroke-card" strokeWidth={2} />
          </g>
        )}
      </svg>
      {shown !== null && shownSpeed !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-border/60 bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-sm"
          style={{ left: `${Math.min(Math.max(x(shown) / WIDTH * 100, 14), 86)}%` }}
        >
          <span className="text-muted-foreground">{hourLabel(shown)}</span> <span className="font-mono font-medium">{shownSpeed} mph</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{label} average speed by hour</caption>
        <tbody>
          {pattern.byHour.map((mph, hour) => mph !== null && (
            <tr key={hour}><th scope="row">{hourLabel(hour)}</th><td>{mph} mph</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DirectionCard({ direction, route, pattern, days }: { direction: string; route: string; pattern: DirectionPattern; days: number }) {
  const hourly = pattern.byHour.some(value => value !== null);
  const weekly = pattern.byDay.every(value => value !== null);
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{direction}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{route}</div>
        </div>
        {pattern.typical !== null && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Typical</div>
            <div><span className="text-2xl font-mono font-semibold">{pattern.typical}</span><span className="text-sm text-muted-foreground ml-1">mph</span></div>
          </div>
        )}
      </div>

      {hourly ? <HourlyProfile pattern={pattern} label={direction} /> : (
        <p className="text-sm text-muted-foreground py-6">Not enough readings yet for this direction.</p>
      )}

      <div className="mt-4 pt-4 border-t border-border/50">
        {weekly ? (
          <>
            <div className="grid grid-cols-7 gap-1 text-center">
              {pattern.byDay.map((mph, i) => {
                const slowest = pattern.slowestDay?.day === DAYS[i];
                return (
                  <div key={DAYS[i]} className={`rounded-md py-1.5 ${slowest ? "bg-muted" : ""}`}>
                    <div className={`text-[11px] ${slowest ? "text-foreground font-medium" : "text-muted-foreground"}`}>{DAYS[i]}</div>
                    <div className={`text-xs font-mono mt-0.5 ${slowest ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{mph !== null ? Math.round(mph) : "—"}</div>
                  </div>
                );
              })}
            </div>
            {pattern.slowestDay && pattern.slowestHour && (
              <p className="text-xs text-muted-foreground mt-3">
                Slowest on <span className="text-foreground">{pattern.slowestDay.day}</span> ({pattern.slowestDay.speed} mph) and around <span className="text-foreground">{hourLabel(pattern.slowestHour.hour)}</span> ({pattern.slowestHour.speed} mph).
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {pattern.slowestHour && pattern.byHour[pattern.slowestHour.hour] != null ? <>Slowest around <span className="text-foreground">{hourLabel(pattern.slowestHour.hour)}</span> ({pattern.slowestHour.speed} mph). </> : null}
            Day-by-day averages appear after a full week ({Math.min(days, 7)} of 7 days so far).
          </p>
        )}
      </div>
    </div>
  );
}

export default function TrafficPatterns() {
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/patterns", { cache: "no-store", signal: controller.signal })
      .then(response => response.json())
      .then(result => { if (!result?.success || !isPatterns(result.data)) throw new Error("Patterns unavailable"); setPatterns(result.data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  return failed ? null : <TrafficPatternsView patterns={patterns} />;
}

export function TrafficPatternsView({ patterns }: { patterns: Patterns | null }) {
  const since = patterns?.since ? new Date(patterns.since).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }) : null;
  const ready = patterns && patterns.days >= 2 && (patterns.directions.eastbound.byHour.some(v => v !== null) || patterns.directions.westbound.byHour.some(v => v !== null));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Traffic Patterns</h2>
        {since && ready && <span className="text-xs text-muted-foreground">Since {since} · {patterns!.days} days</span>}
      </div>
      {!patterns ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">Loading traffic patterns…</div>
      ) : !ready ? (
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 flex items-start gap-3">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-foreground">Building traffic patterns</p>
            <p className="text-sm text-muted-foreground mt-1">Speeds are recorded every 30 minutes. Hourly patterns appear after two days, and day-by-day averages after a full week.</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 flex gap-0.5 h-1.5" aria-hidden="true">
                {DAYS.map((day, i) => <div key={day} className={`flex-1 first:rounded-l-full last:rounded-r-full ${i < patterns.days ? "bg-foreground" : "bg-foreground/12"}`} />)}
              </div>
              <span className="text-xs font-mono text-muted-foreground">{Math.min(patterns.days, 7)}/7 days</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="metric-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DirectionCard direction="Eastbound" route="Ipswich → Felixstowe" pattern={patterns.directions.eastbound} days={patterns.days} />
          <DirectionCard direction="Westbound" route="Felixstowe → Ipswich" pattern={patterns.directions.westbound} days={patterns.days} />
        </div>
      )}
    </div>
  );
}
