import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ParsedEventSchema } from '@/lib/schema';
import { parseEmail } from '@/lib/aiClient';
import { geocode } from '@/lib/geocode';

const BodySchema = z.object({
  raw_text: z.string().min(1),
  provider: z.enum(['cloud', 'free', 'local', 'auto', 'none']).optional(),
  /** Optional client-supplied per-provider timeout, capped at 10s server-side. */
  timeoutMs: z.number().int().positive().max(10_000).optional(),
});

const DEFAULT_PARSE_TIMEOUT_MS = 8_000;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return err('BAD_REQUEST', parsed.error.message, 400);

  try {
    const events = await parseEmail(parsed.data.raw_text, {
      provider:  parsed.data.provider ?? 'auto',
      timeoutMs: parsed.data.timeoutMs ?? DEFAULT_PARSE_TIMEOUT_MS,
    });
    
    // Server-side enrichment: Geocode hotel addresses
    for (const ev of events) {
      if (ev.type === 'hotel' && ev.parsedJson && typeof ev.parsedJson === 'object') {
        const address = (ev.parsedJson as any).address;
        const query = address || ev.locationName;
        if (query) {
          const geo = await geocode(query);
          if (geo) {
            ev.lat = geo.lat;
            ev.lng = geo.lng;
            // If we only had an address, or the location name was generic, update it
            if (!ev.locationName || ev.locationName.length < 5) {
              ev.locationName = geo.name;
            }
          } else {
            ev.status = 'needs_review';
            ev.confidence = Math.min(ev.confidence, 0.5);
          }
        }
      }
    }

    const validated = ParsedEventSchema.array().safeParse(events);
    if (!validated.success) return err('AI_PROVIDER_FAILED', 'Parser returned invalid shape', 500);

    // Surface a top-level needsReview flag whenever ANY event was downgraded
    // (LLM timeout / low confidence / geocoder uncertain). The per-event
    // `status: 'needs_review'` field is the source of truth; this is a
    // convenience for the client.
    const needsReview = validated.data.some((e) => e.status === 'needs_review');

    return NextResponse.json({ data: validated.data, needsReview, error: null });
  } catch (e) {
    return err('AI_PROVIDER_FAILED', String(e), 500);
  }
}
