/**
 * Dependency-free UUID v4 generator.
 * Uses crypto.randomUUID() where available, with a cryptographically secure
 * fallback using crypto.getRandomValues().
 */
export function uuidv4(): string {
  // Use built-in randomUUID if available (modern browsers & Node 19+)
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback to getRandomValues (older browsers)
  const buf = new Uint8Array(16);
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // Last resort fallback for non-crypto environments (SSR/Edge)
    for (let i = 0; i < 16; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version to 4 (0100xxxx)
  const b6 = buf[6];
  const b8 = buf[8];
  if (b6 !== undefined) buf[6] = (b6 & 0x0f) | 0x40;
  // Set variant to 1 (10xxxxxx)
  if (b8 !== undefined) buf[8] = (b8 & 0x3f) | 0x80;

  const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
