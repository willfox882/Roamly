/**
 * @jest-environment node
 */
import { createHmac } from 'crypto';

// Set the secret BEFORE importing the route so module-level reads are stable.
process.env.SYNC_JWT_SECRET = 'test-secret-do-not-use-in-prod';

import { POST, __setBlobStoreForTests, type BlobStore } from '@/app/api/sync/route';

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(claims: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/sync', () => {
  const SECRET = 'test-secret-do-not-use-in-prod';
  let putCalls: Array<[string, string]>;

  beforeEach(() => {
    putCalls = [];
    const fake: BlobStore = {
      async put(userId, blob) {
        putCalls.push([userId, blob]);
      },
    };
    __setBlobStoreForTests(fake);
  });

  afterAll(() => {
    __setBlobStoreForTests(null);
  });

  it('returns 401 when Authorization header is missing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(makeReq({ blob: 'aGVsbG8=' }) as any);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when JWT signature is invalid', async () => {
    const bad = makeJwt({ sub: 'u1' }, 'wrong-secret');
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ blob: 'aGVsbG8=' }, { authorization: `Bearer ${bad}` }) as any,
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is invalid JSON', async () => {
    const jwt = makeJwt({ sub: 'u1' }, SECRET);
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq('not-json{{{', { authorization: `Bearer ${jwt}` }) as any,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when payload looks like plaintext (contains "flights")', async () => {
    const jwt = makeJwt({ sub: 'u1' }, SECRET);
    const res = await POST(
      makeReq(
        { flights: [{ from: 'YVR', to: 'LHR' }] },
        { authorization: `Bearer ${jwt}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/plaintext/i);
  });

  it('returns 400 when payload looks like plaintext (contains "hotel")', async () => {
    const jwt = makeJwt({ sub: 'u1' }, SECRET);
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ hotel: { name: 'X' } }, { authorization: `Bearer ${jwt}` }) as any,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when blob is missing or empty', async () => {
    const jwt = makeJwt({ sub: 'u1' }, SECRET);
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({}, { authorization: `Bearer ${jwt}` }) as any,
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 for a valid blob with valid auth', async () => {
    const jwt = makeJwt({ sub: 'user-42' }, SECRET);
    const blob = Buffer.from(JSON.stringify({ v: 1, ct: 'x', iv: 'y', salt: 'z' })).toString(
      'base64',
    );
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ blob }, { authorization: `Bearer ${jwt}` }) as any,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ok).toBe(true);
    expect(putCalls).toEqual([['user-42', blob]]);
  });

  it('returns 401 for an expired JWT', async () => {
    const jwt = makeJwt({ sub: 'u1', exp: 1 }, SECRET);
    const res = await POST(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ blob: 'aGVsbG8=' }, { authorization: `Bearer ${jwt}` }) as any,
    );
    expect(res.status).toBe(401);
  });
});
