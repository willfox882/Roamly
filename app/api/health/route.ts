/**
 * STUB — GET /api/health. Used by useOffline heartbeat.
 * Returns: { ok: true, ts: ISO }.
 * TODO(sonnet): keep tiny — no auth, no DB.
 */
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
