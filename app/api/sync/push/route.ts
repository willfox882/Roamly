import { type NextRequest, NextResponse } from 'next/server';
import { PushBodySchema } from '@/lib/schema';
import { tripsRepo, eventsRepo } from '@/server/db/sqlite';
import type { Trip, Event, ConflictDescriptor } from '@/lib/schema';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }

  const parsed = PushBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { records } = parsed.data;
  const accepted: string[] = [];
  const conflicts: ConflictDescriptor[] = [];

  const trips = tripsRepo();
  const events = eventsRepo();

  const tripMap = records['trips'];
  if (tripMap) {
    for (const [id, payload] of Object.entries(tripMap)) {
      const remote = payload as Trip;
      const existing = trips.findById(id);
      if (!existing || remote.lastModifiedAt > existing.lastModifiedAt) {
        trips.upsert(remote);
        accepted.push(id);
      } else if (remote.lastModifiedAt < existing.lastModifiedAt) {
        conflicts.push({
          recordType: 'trips',
          id,
          localVersion: existing as Record<string, unknown>,
          remoteVersion: remote as Record<string, unknown>,
          fields: [],
        });
      } else {
        accepted.push(id);
      }
    }
  }

  const eventMap = records['events'];
  if (eventMap) {
    for (const [id, payload] of Object.entries(eventMap)) {
      const remote = payload as Event;
      const existing = events.findById(id);
      if (!existing || remote.lastModifiedAt > existing.lastModifiedAt) {
        events.upsert(remote);
        accepted.push(id);
      } else if (remote.lastModifiedAt < existing.lastModifiedAt) {
        conflicts.push({
          recordType: 'events',
          id,
          localVersion: existing as Record<string, unknown>,
          remoteVersion: remote as Record<string, unknown>,
          fields: [],
        });
      } else {
        accepted.push(id);
      }
    }
  }

  return NextResponse.json({ data: { accepted, conflicts }, error: null });
}
