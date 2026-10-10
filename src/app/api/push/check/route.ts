import { NextResponse } from 'next/server';
import { authorizedCron, checkClosures, pushEnabled } from '@/lib/push';
import { refreshTrafficReading } from '@/lib/reading';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!pushEnabled()) {
    // Without alerts the schedule still keeps the shared traffic reading warm.
    try { await refreshTrafficReading(); return NextResponse.json({ refreshed: true, alerts: false }, { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return NextResponse.json({ error: 'Traffic refresh failed' }, { status: 503 }); }
  }
  try { return NextResponse.json(await checkClosures(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Closure check failed' }, { status: 503 }); }
}
