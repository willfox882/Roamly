import { type NextRequest, NextResponse } from 'next/server';
import { tripsRepo, eventsRepo } from '@/server/db/sqlite';

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since') ?? '1970-01-01T00:00:00.000Z';

  const trips = tripsRepo();
  const events = eventsRepo();

  const changedTrips = trips.findModifiedSince(since);
  const changedEvents = events.findModifiedSince(since);

  return NextResponse.json({
    data: {
      records: {
        trips: changedTrips,
        events: changedEvents,
      },
      deletedIds: {},
      serverTs: new Date().toISOString(),
    },
    error: null,
  });
}
