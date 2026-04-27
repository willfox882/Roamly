import {
  deriveKeyFromPassphrase,
  encryptPayload,
  decryptPayload,
  sealPayload,
  PAYLOAD_PBKDF2_ITERS,
} from '@/lib/crypto';

describe('crypto: v1 opaque-blob API', () => {
  // Use a reduced iteration count in tests so PBKDF2 doesn't dominate runtime;
  // still exercises the code path identically.
  const ITERS = 1_000;

  it('round-trips plaintext through derive → encrypt → decrypt', async () => {
    const passphrase = 'correct horse battery staple';
    const plaintext = 'hello world — Roamly E2EE';

    const { key, salt } = await deriveKeyFromPassphrase(passphrase, undefined, ITERS);
    const blob = await encryptPayload(plaintext, key, salt);

    expect(blob.v).toBe(1);
    expect(typeof blob.ct).toBe('string');
    expect(typeof blob.iv).toBe('string');
    expect(typeof blob.salt).toBe('string');

    const out = await decryptPayload(blob, passphrase, ITERS);
    expect(out).toBe(plaintext);
  });

  it('round-trips via sealPayload one-shot helper', async () => {
    const blob = await sealPayload('hello', 'pw', ITERS);
    const out = await decryptPayload(blob, 'pw', ITERS);
    expect(out).toBe('hello');
  });

  it('produces a fresh salt+iv for each encryption (probabilistic)', async () => {
    const a = await sealPayload('same plaintext', 'pw', ITERS);
    const b = await sealPayload('same plaintext', 'pw', ITERS);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    const blob = await sealPayload('secret', 'right', ITERS);
    await expect(decryptPayload(blob, 'wrong', ITERS)).rejects.toThrow();
  });

  it('rejects unsupported blob versions', async () => {
    const blob = await sealPayload('x', 'pw', ITERS);
    const tampered = { ...blob, v: 2 as unknown as 1 };
    await expect(decryptPayload(tampered, 'pw', ITERS)).rejects.toThrow(/UNSUPPORTED/);
  });

  it('encrypts Uint8Array input identically to string input', async () => {
    const { key, salt } = await deriveKeyFromPassphrase('pw', undefined, ITERS);
    const bytes = new TextEncoder().encode('bytes-in');
    const blob = await encryptPayload(bytes, key, salt);
    const out = await decryptPayload(blob, 'pw', ITERS);
    expect(out).toBe('bytes-in');
  });

  it('exports a sane default iteration count for production', () => {
    expect(PAYLOAD_PBKDF2_ITERS).toBeGreaterThanOrEqual(200_000);
  });
});
