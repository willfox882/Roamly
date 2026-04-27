import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ParsedEventSchema } from '@/lib/schema';
import { parseEmail } from '@/lib/aiClient';

const BodySchema = z.object({
  raw_text: z.string().min(1),
  provider: z.enum(['cloud', 'free', 'local', 'auto', 'none']).optional(),
});

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return err('BAD_REQUEST', parsed.error.message, 400);

  try {
    const events = await parseEmail(parsed.data.raw_text, { provider: parsed.data.provider });
    const validated = ParsedEventSchema.array().safeParse(events);
    if (!validated.success) return err('AI_PROVIDER_FAILED', 'Invalid parse result shape', 500);
    return NextResponse.json({ data: validated.data, error: null });
  } catch (e) {
    return err('AI_PROVIDER_FAILED', String(e), 500);
  }
}
