import seedData from './seed.json';
import { BackupBundleSchema } from '@/lib/schema';

// Validate the seed JSON at load time so malformed seed data fails loudly
const bundle = BackupBundleSchema.parse(seedData);

export async function runSeedInBrowser(): Promise<void> {
  // Lazy-import db so this module is safe to tree-shake in non-browser contexts
  const { writeBundle, wipeAll } = await import('@/lib/db');
  await wipeAll();
  await writeBundle(bundle, 'overwrite');
  console.log('[seed] done — wrote', Object.values(bundle.records).flat().length, 'records');
}

// ── Node / CLI entry point ────────────────────────────────────────────────────

if (require.main === module) {
  void (async () => {
    // Polyfill IndexedDB for Node
    const { IDBFactory } = await import('fake-indexeddb');
    // reason: IDBFactory type in fake-indexeddb doesn't perfectly match the DOM type
    (globalThis as unknown as Record<string, unknown>)['indexedDB'] = new IDBFactory();

    const { writeBundle, wipeAll, readBundle } = await import('@/lib/db');
    await wipeAll();
    await writeBundle(bundle, 'overwrite');

    const written = await readBundle();
    const total =
      written.records.trips.length +
      written.records.events.length +
      written.records.bucketPins.length +
      written.records.exclusions.length;

    console.log(`[seed] wrote ${total} records to in-memory Dexie.`);

    // Export a demo bundle JSON for the /onboarding import flow
    const fs = await import('fs');
    const path = await import('path');
    const outDir = path.join(process.cwd(), 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'demo-bundle.json');
    fs.writeFileSync(outPath, JSON.stringify(written, null, 2));
    console.log(`[seed] demo bundle written to ${outPath}`);
  })();
}
