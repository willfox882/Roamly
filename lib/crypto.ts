import type { EncryptedEnvelope } from '@/lib/schema';

// ── Buffer helpers ────────────────────────────────────────────────────────────

// Web Crypto API types require ArrayBufferView<ArrayBuffer>, not ArrayBufferLike.
// This cast is safe: new Uint8Array(n) and crypto.getRandomValues always use plain ArrayBuffers.
function asView(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as unknown as Uint8Array<ArrayBuffer>;
}

// ── Base64 helpers ────────────────────────────────────────────────────────────

function toBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
  return btoa(binary);
}

function fromBase64(s: string): Uint8Array {
  const binary = atob(s);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', asView(bytes));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Timing-safe hex string comparison. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = 250_000,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asView(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(
  plaintext: string | Uint8Array,
  key: CryptoKey,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = randomBytes(12);
  const data = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asView(iv) }, key, asView(data));
  return { iv, ciphertext: new Uint8Array(ct) };
}

export async function decrypt(
  { iv, ciphertext }: { iv: Uint8Array; ciphertext: Uint8Array },
  key: CryptoKey,
): Promise<Uint8Array> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asView(iv) }, key, asView(ciphertext));
    return new Uint8Array(pt);
  } catch {
    throw new Error('DECRYPT_FAILED');
  }
}

export async function wrapEnvelope(
  plaintext: string,
  passphrase: string,
  iterations = 250_000,
): Promise<EncryptedEnvelope> {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, iterations);
  const { iv, ciphertext } = await encrypt(plaintext, key);
  const hash = await sha256(plaintext);
  return {
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
    sha256: hash,
  };
}

export async function unwrapEnvelope(
  env: EncryptedEnvelope,
  passphrase: string,
): Promise<string> {
  const salt = fromBase64(env.salt);
  const iv = fromBase64(env.iv);
  const ciphertext = fromBase64(env.ciphertext);
  const key = await deriveKey(passphrase, salt, env.iterations);
  // throws DECRYPT_FAILED on wrong passphrase or tampered ciphertext
  const plaintext = await decrypt({ iv, ciphertext }, key);
  const text = new TextDecoder().decode(plaintext);
  const actualHash = await sha256(text);
  if (!constantTimeEqualHex(actualHash, env.sha256)) throw new Error('SHA256_MISMATCH');
  return text;
}

// ── Compact opaque-blob API for cloud-sync uploads ────────────────────────────
// Format v1: { v: 1, ct, iv, salt } — base64-encoded fields, AES-256-GCM,
// PBKDF2-SHA256 @ 200k iterations. Distinct from EncryptedEnvelope (which
// remains the format used for backups). Used by the encrypted-sync path.

export const PAYLOAD_PBKDF2_ITERS = 200_000;

export type EncryptedPayloadBlob = {
  v: 1;
  ct: string;
  iv: string;
  salt: string;
};

/**
 * Derive an AES-GCM key from a passphrase. If `salt` is omitted, a fresh
 * 16-byte salt is generated; callers can read the salt off the resulting
 * blob produced by `encryptPayload`.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: Uint8Array,
  iterations: number = PAYLOAD_PBKDF2_ITERS,
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const useSalt = salt ?? randomBytes(16);
  const key = await deriveKey(passphrase, useSalt, iterations);
  return { key, salt: useSalt };
}

/**
 * Encrypt a payload with a derived key. The caller must keep track of the
 * salt used to derive the key (pass it in via `salt`) so it can be embedded
 * in the resulting blob. Use `sealPayload` for a one-shot passphrase API.
 */
export async function encryptPayload(
  plaintext: Uint8Array | string,
  key: CryptoKey,
  salt: Uint8Array,
): Promise<EncryptedPayloadBlob> {
  const { iv, ciphertext } = await encrypt(plaintext, key);
  return {
    v: 1,
    ct: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/** Decrypt a v1 blob back to its original UTF-8 plaintext string. */
export async function decryptPayload(
  blob: EncryptedPayloadBlob,
  passphrase: string,
  iterations: number = PAYLOAD_PBKDF2_ITERS,
): Promise<string> {
  if (blob.v !== 1) throw new Error('UNSUPPORTED_BLOB_VERSION');
  const salt = fromBase64(blob.salt);
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ct);
  const key = await deriveKey(passphrase, salt, iterations);
  const pt = await decrypt({ iv, ciphertext }, key);
  return new TextDecoder().decode(pt);
}

/** One-shot: derive key + encrypt + return the opaque JSON blob for upload. */
export async function sealPayload(
  plaintext: Uint8Array | string,
  passphrase: string,
  iterations: number = PAYLOAD_PBKDF2_ITERS,
): Promise<EncryptedPayloadBlob> {
  const { key, salt } = await deriveKeyFromPassphrase(passphrase, undefined, iterations);
  return encryptPayload(plaintext, key, salt);
}
