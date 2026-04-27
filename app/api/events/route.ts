import { type NextRequest, NextResponse } from 'next/server';
import { EventSchema } from '@/lib/schema';
import { eventsRepo } from '@/server/db/sqlite';
import { v4 as uuidv4 } from 'uuid';

const STUB_USER = '00000000-0000-4000-a000-000000000001';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function GET(req: NextRequest) {
  const tripId = new URL(req.url).searchParams.get('trip_id');
  if (!tripId) return err('BAD_REQUEST', 'trip_id query param required', 400);

  try {
    const events = eventsRepo().findByTrip(tripId);
    return NextResponse.json({ data: events, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = EventSchema.omit({ id: true }).safeParse(body);
  if (!parsed.success) return err('BAD_REQUEST', parsed.error.message, 400);

  const event = EventSchema.parse({
    ...parsed.data,
    id: uuidv4(),
    userId: STUB_USER,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
  });

  try {
    const saved = eventsRepo().upsert(event);
    return NextResponse.json({ data: saved, error: null }, { status: 201 });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}
