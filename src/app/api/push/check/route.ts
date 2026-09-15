import { NextResponse } from 'next/server';
import { authorizedCron, checkClosures, pushEnabled } from '@/lib/push';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!pushEnabled()) return NextResponse.json({ error: 'Alerts are not configured' }, { status: 503 });
  try { return NextResponse.json(await checkClosures(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'Closure check failed' }, { status: 503 }); }
}
