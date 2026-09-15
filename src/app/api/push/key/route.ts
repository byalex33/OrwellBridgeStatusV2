import { NextResponse } from 'next/server';
import { pushEnabled } from '@/lib/push';
export const dynamic = 'force-dynamic';
export async function GET() {
  const enabled = pushEnabled();
  return NextResponse.json({ enabled, publicKey: enabled ? process.env.VAPID_PUBLIC_KEY : null }, { headers: { 'Cache-Control': 'no-store' } });
}
