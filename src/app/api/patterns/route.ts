import { NextResponse } from 'next/server';
import { getTrafficPatterns } from '@/lib/patterns';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

// Patterns move slowly; one database read per instance every half hour is plenty.
export async function GET() {
  try {
    const data = await cache.getOrFetch('traffic-patterns', getTrafficPatterns, 1800, 1800);
    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Traffic patterns unavailable', { message: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ success: false, data: null }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
