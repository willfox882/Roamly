import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

// jsdom may not expose TextEncoder/TextDecoder globally in older versions.
if (!globalThis.TextEncoder) {
  Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, configurable: true });
}
if (!globalThis.TextDecoder) {
  Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true });
}

// Node ≥18 exposes webcrypto globally, but jsdom may not wire SubtleCrypto; ensure it's available.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

// structuredClone was added in Node 17; polyfill for older environments.
if (!globalThis.structuredClone) {
  // reason: simple deep-clone polyfill via JSON round-trip (sufficient for IndexedDB use)
  (globalThis as Record<string, unknown>)['structuredClone'] = <T>(v: T): T =>
    JSON.parse(JSON.stringify(v)) as T;
}
