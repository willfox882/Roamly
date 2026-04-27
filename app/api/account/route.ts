import { type NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/app/api/sync/route';

/**
 * DELETE /api/account — irrevocably remove the caller's cloud-side data.
 *
 * Mirrors the auth scheme of /api/sync (HS256 bearer with sub claim). The
 * actual server-side deletion target (encrypted-blob row, audit log,
 * subscription record, etc.) is wired by the deployment layer; this handler
 * is the contract surface and a no-op stub for the local-first build.
 *
 * The CLIENT is responsible for clearing local Dexie state — see
 * app/settings/page.tsx → handleDeleteAccount.
 */
export async function DELETE(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authz);
  if (!match) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } },
      { status: 401 },
    );
  }

  const secret = process.env.SYNC_JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { data: null, error: { code: 'SERVER_MISCONFIG', message: 'SYNC_JWT_SECRET not set' } },
      { status: 500 },
    );
  }

  let userId: string;
  try {
    const claims = verifyJwt(match[1]!, secret);
    if (typeof claims.sub !== 'string') throw new Error('JWT missing sub');
    userId = claims.sub;
  } catch (err) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: (err as Error).message } },
      { status: 401 },
    );
  }

  // ── Cloud-side deletion hook ────────────────────────────────────────────
  // Replace this block with the real deletion logic when storage lands
  // (e.g., Supabase row delete, R2 object delete, Stripe customer cancel).
  // Keep it idempotent: a second DELETE for an already-removed account
  // should still 200 so retries don't surface as errors to the client.
  // For now this is a no-op acknowledgement.

  return NextResponse.json({ data: { ok: true, userId }, error: null });
}
