import { type NextRequest, NextResponse } from 'next/server';
import { EventSchema } from '@/lib/schema';
import { eventsRepo } from '@/server/db/sqlite';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const existing = eventsRepo().findById(params.id);
  if (!existing) return err('NOT_FOUND', 'Event not found', 404);

  const merged = EventSchema.safeParse({
    ...existing,
    ...body,
    id: params.id,
    lastModifiedAt: new Date().toISOString(),
  });
  if (!merged.success) return err('BAD_REQUEST', merged.error.message, 400);

  try {
    const saved = eventsRepo().upsert(merged.data);
    return NextResponse.json({ data: saved, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    eventsRepo().delete(params.id);
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}
