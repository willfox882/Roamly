import { type NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

// ── Body schema ───────────────────────────────────────────────────────────────
// The endpoint accepts a single opaque base64 blob produced by lib/crypto.ts
// (sealPayload/encryptPayload). The server MUST never see plaintext records.

const BlobBodySchema = z
  .object({
    blob: z
      .string()
      .min(1)
      // base64 (standard, with optional padding)
      .regex(/^[A-Za-z0-9+/]+=*$/, 'blob must be base64'),
  })
  .strict();

// Plaintext fingerprint: if any of these keys appear at the top level we
// assume the client mistakenly uploaded unencrypted records and refuse.
const PLAINTEXT_KEYS = [
  'flights',
  'hotel',
  'hotels',
  'trips',
  'events',
  'records',
  'pnr',
  'confirmationNumber',
];

// ── JWT (HS256) verification ──────────────────────────────────────────────────
// Minimal verifier so we don't pull in `jose`/`jsonwebtoken` for one route.
// Replace `verifyJwt` with the project's auth lib once it exists.

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export type JwtClaims = { sub?: string; exp?: number; iat?: number; [k: string]: unknown };

export function verifyJwt(token: string, secret: string): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT_MALFORMED');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const header = JSON.parse(b64urlDecode(headerB64).toString('utf8')) as { alg?: string };
  if (header.alg !== 'HS256') throw new Error('JWT_BAD_ALG');

  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = b64urlDecode(sigB64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('JWT_BAD_SIG');
  }

  const claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as JwtClaims;
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    throw new Error('JWT_EXPIRED');
  }
  return claims;
}

function authError(msg: string) {
  return NextResponse.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: msg } },
    { status: 401 },
  );
}

function badRequest(msg: string) {
  return NextResponse.json(
    { data: null, error: { code: 'BAD_REQUEST', message: msg } },
    { status: 400 },
  );
}

// ── Pluggable blob store ──────────────────────────────────────────────────────
// In-memory by default; tests can swap via __setBlobStoreForTests. Production
// wiring (Supabase row, R2 object, etc.) is out of scope for this patch.

export interface BlobStore {
  put(userId: string, blob: string): Promise<void>;
}

const memoryStore: Map<string, string> = new Map();
let store: BlobStore = {
  async put(userId, blob) {
    memoryStore.set(userId, blob);
  },
};

export function __setBlobStoreForTests(s: BlobStore | null): void {
  store = s ?? {
    async put(userId, blob) {
      memoryStore.set(userId, blob);
    },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  const authz = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authz);
  if (!match) return authError('Missing bearer token');

  const secret = process.env.SYNC_JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { data: null, error: { code: 'SERVER_MISCONFIG', message: 'SYNC_JWT_SECRET not set' } },
      { status: 500 },
    );
  }

  let claims: JwtClaims;
  try {
    claims = verifyJwt(match[1]!, secret);
  } catch (err) {
    return authError((err as Error).message);
  }
  const userId = typeof claims.sub === 'string' ? claims.sub : null;
  if (!userId) return authError('JWT missing sub');

  // 2. Parse + validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  if (raw && typeof raw === 'object') {
    const keys = Object.keys(raw as Record<string, unknown>);
    if (keys.some((k) => PLAINTEXT_KEYS.includes(k))) {
      return badRequest('Plaintext payload rejected; upload an encrypted blob');
    }
  }

  const parsed = BlobBodySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  // 3. Persist
  await store.put(userId, parsed.data.blob);
  return NextResponse.json({ data: { ok: true }, error: null });
}
