import type { GustForecast } from '@/types/bridge';

// National Highways: 40mph limit above 50mph forecast winds, closure at 60mph+ gusts.
const LIMIT_GUST = 50;
const CLOSURE_GUST = 60;
const SCALE_MAX = 70;

const position = (mph: number) => `${(Math.min(Math.max(mph, 0), SCALE_MAX) / SCALE_MAX) * 100}%`;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

function expectedLimit(gust: number) {
  if (gust >= CLOSURE_GUST) return { value: 'Closed', unit: '', note: 'Gusts at the closure threshold', tone: 'text-rose-700 dark:text-rose-400' };
  if (gust > LIMIT_GUST) return { value: '40', unit: 'mph', note: 'High-wind limit likely', tone: 'text-amber-700 dark:text-amber-400' };
  return { value: '60', unit: 'mph', note: 'Normal limit', tone: 'text-foreground' };
}

export default function WindGauge({ gust, forecast }: { gust?: number; forecast?: GustForecast }) {
  if (gust === undefined) return null;
  const limit = expectedLimit(gust);
  const zones = [
    { from: 0, to: LIMIT_GUST, fill: 'bg-foreground/12', label: 'Normal' },
    { from: LIMIT_GUST, to: CLOSURE_GUST, fill: 'bg-amber-400/70', label: '40 mph' },
    { from: CLOSURE_GUST, to: SCALE_MAX, fill: 'bg-rose-400/70', label: 'Closed' },
  ];
  const summary = `Gusts ${gust} mph now${forecast ? `, peaking at ${forecast.peak} mph in the next 24 hours` : ''}. A 40 mph limit applies above ${LIMIT_GUST} mph and the bridge closes at ${CLOSURE_GUST} mph.`;

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 sm:p-5 mt-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <div className="text-xs text-muted-foreground mb-2">Expected speed limit</div>
          <div className={`flex items-baseline gap-1 ${limit.tone}`}>
            <span className="text-3xl font-mono font-semibold">{limit.value}</span>
            {limit.unit && <span className="text-base text-muted-foreground">{limit.unit}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{limit.note}</div>
        </div>
        <dl className="flex gap-6 sm:text-right">
          <div>
            <dt className="text-xs text-muted-foreground mb-2">Gusts now</dt>
            <dd><span className="text-3xl font-mono font-semibold">{gust}</span><span className="text-base text-muted-foreground ml-1">mph</span></dd>
          </div>
          {forecast && (
            <div>
              <dt className="text-xs text-muted-foreground mb-2">24h peak</dt>
              <dd><span className="text-3xl font-mono font-semibold">{forecast.peak}</span><span className="text-base text-muted-foreground ml-1">mph</span></dd>
              <dd className="text-xs text-muted-foreground mt-1">{formatTime(forecast.at)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6" role="img" aria-label={summary}>
        <div className="relative h-2">
          <div className="absolute inset-0 flex gap-0.5">
            {zones.map(zone => (
              <div key={zone.label} className={`h-full first:rounded-l-full last:rounded-r-full ${zone.fill}`} style={{ width: `${((zone.to - zone.from) / SCALE_MAX) * 100}%` }} />
            ))}
          </div>
          {forecast && forecast.peak !== gust && (
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-foreground bg-card" style={{ left: position(forecast.peak) }} />
          )}
          <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-foreground ring-2 ring-card" style={{ left: position(gust) }} />
        </div>
        <div className="relative h-4 mt-2 text-[11px] font-mono text-muted-foreground" aria-hidden="true">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: position(LIMIT_GUST) }}>{LIMIT_GUST}</span>
          <span className="absolute -translate-x-1/2" style={{ left: position(CLOSURE_GUST) }}>{CLOSURE_GUST}</span>
          <span className="absolute right-0">{SCALE_MAX}+</span>
        </div>
        <div className="flex gap-0.5 mt-1 text-[11px] text-muted-foreground" aria-hidden="true">
          {zones.map(zone => (
            <span key={zone.label} className="truncate" style={{ width: `${((zone.to - zone.from) / SCALE_MAX) * 100}%` }}>{zone.label}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-foreground" />Now</span>
        {forecast && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-foreground" />24h peak</span>}
        <span className="basis-full sm:basis-auto sm:ml-auto">Forecast gusts at 10 m. The deck is higher and windier; follow the signs.</span>
      </div>
    </div>
  );
}
