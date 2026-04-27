import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TripSchema } from '@/lib/schema';
import { tripsRepo } from '@/server/db/sqlite';
import { v4 as uuidv4 } from 'uuid';

const STUB_USER = '00000000-0000-4000-a000-000000000001';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function GET() {
  try {
    const trips = tripsRepo().findAll(STUB_USER);
    return NextResponse.json({ data: trips, error: null });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const CreateSchema = TripSchema.omit({ id: true }).extend({ id: z.string().uuid().optional() });
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return err('BAD_REQUEST', parsed.error.message, 400);

  const trip = TripSchema.parse({
    ...parsed.data,
    id: parsed.data.id ?? uuidv4(),
    userId: STUB_USER,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
  });

  try {
    const saved = tripsRepo().upsert(trip);
    return NextResponse.json({ data: saved, error: null }, { status: 201 });
  } catch (e) {
    return err('INTERNAL', String(e), 500);
  }
}
