import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RecommendationSchema } from '@/lib/schema';
import { recommend } from '@/lib/aiClient';

const BodySchema = z.object({
  lat:         z.number(),
  lng:         z.number(),
  startDate:   z.string(),
  endDate:     z.string(),
  exclusions:  z.array(z.string()).default([]),
  preferences: z.record(z.unknown()).default({}),
  provider:    z.enum(['cloud', 'free', 'local', 'auto', 'none']).optional(),
});

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return err('BAD_REQUEST', parsed.error.message, 400);

  const { provider, ...input } = parsed.data;

  try {
    const recs = await recommend(input, { provider });
    const validated = RecommendationSchema.array().safeParse(recs);
    if (!validated.success) return err('AI_PROVIDER_FAILED', 'Invalid recommendation shape', 500);
    return NextResponse.json({ data: validated.data, error: null });
  } catch (e) {
    return err('AI_PROVIDER_FAILED', String(e), 500);
  }
}
