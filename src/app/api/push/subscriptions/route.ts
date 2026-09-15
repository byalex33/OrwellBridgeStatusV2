import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { pushEnabled, sameOrigin, saveSubscription, validateSubscription } from '@/lib/push';
async function update(request: Request, active: boolean) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (active && !pushEnabled()) return NextResponse.json({ error: 'Alerts are not configured yet' }, { status: 503 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'Expected JSON' }, { status: 415 });
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing body');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
    input = validateSubscription(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }
  try {
    await saveSubscription(input, active);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to update subscription' }, { status: 503 });
  }
}
export async function POST(request: Request) { return update(request, true); }
export async function DELETE(request: Request) { return update(request, false); }
