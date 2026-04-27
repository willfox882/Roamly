import { type NextRequest, NextResponse } from 'next/server';
import { TripSchema } from '@/lib/schema';
import { tripsRepo } from '@/server/db/sqlite';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trip = tripsRepo().findById(params.id);
    if (!trip) return err('NOT_FOUND', 'Trip not found', 404);
    return NextResponse.json({ data: trip, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const existing = tripsRepo().findById(params.id);
  if (!existing) return err('NOT_FOUND', 'Trip not found', 404);

  const merged = TripSchema.safeParse({ ...existing, ...body, id: params.id, lastModifiedAt: new Date().toISOString() });
  if (!merged.success) return err('BAD_REQUEST', merged.error.message, 400);

  try {
    const saved = tripsRepo().upsert(merged.data);
    return NextResponse.json({ data: saved, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    tripsRepo().delete(params.id);
    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}
