// Roamly Service Worker — Workbox 7 via CDN
// Responsibilities: precache shell, runtime cache, BackgroundSync, periodicSync.

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute, setCatchHandler }                    = workbox.routing;
const { CacheFirst, StaleWhileRevalidate, NetworkOnly }     = workbox.strategies;
const { ExpirationPlugin }                                   = workbox.expiration;
const { BackgroundSyncPlugin }                               = workbox.backgroundSync;
const { precacheAndRoute, cleanupOutdatedCaches }            = workbox.precaching;

workbox.setConfig({ debug: false });
cleanupOutdatedCaches();

// ── Precache (app shell) ───────────────────────────────────────────────────────
// Next.js injects __WB_MANIFEST at build time via next-pwa; for our manual SW
// we precache the key shell routes explicitly at install time.
const SHELL_URLS = ['/', '/map', '/bucket', '/settings', '/onboarding', '/add/parse'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('nv-shell-v1').then((cache) => cache.addAll(SHELL_URLS).catch(() => {})),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Runtime: /api/sync/pull → StaleWhileRevalidate ────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/sync/pull'),
  new StaleWhileRevalidate({ cacheName: 'nv-sync-pull' }),
);

// ── Runtime: map tiles → CacheFirst, 30 days, max 400 entries ─────────────────
registerRoute(
  ({ url }) =>
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('api.mapbox.com'),
  new CacheFirst({
    cacheName: 'nv-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// ── Runtime: GeoJSON boundary data → CacheFirst, 90 days ──────────────────────
// admin1_small.geojson and countries.geojson are large, immutable static assets
// served from /data/. Cache aggressively so the bucket-list map works offline.
registerRoute(
  ({ url }) =>
    url.pathname.endsWith('/admin1_small.geojson') ||
    url.pathname.endsWith('/countries.geojson'),
  new CacheFirst({
    cacheName: 'nv-geojson',
    plugins: [
      new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 90 * 24 * 60 * 60 }),
    ],
  }),
);

// ── Runtime: AI responses → CacheFirst, 24h ───────────────────────────────────
registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/ai/parse') ||
    url.pathname.startsWith('/api/ai/recommend'),
  new CacheFirst({
    cacheName: 'nv-ai',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
);

// ── BackgroundSync: push changes and backup uploads ───────────────────────────
const syncPlugin   = new BackgroundSyncPlugin('nv-sync',   { maxRetentionTime: 24 * 60 });
const backupPlugin = new BackgroundSyncPlugin('nv-backup', { maxRetentionTime: 48 * 60 });

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/sync/push'),
  new NetworkOnly({ plugins: [syncPlugin] }),
  'POST',
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/backups/upload'),
  new NetworkOnly({ plugins: [backupPlugin] }),
  'POST',
);

// ── periodicSync: scheduled backups ───────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'nv-backup') {
    event.waitUntil(
      // Notify the client to run the backup rather than doing it in SW
      // (backup needs Web Crypto + Dexie which are available in the page context)
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'RUN_SCHEDULED_BACKUP' });
        }
      }),
    );
  }
});

// ── Message listener: flush queues on demand ──────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'FLUSH_SYNC_QUEUE') {
    // BackgroundSync plugin will auto-retry; nothing explicit needed here
    event.waitUntil(Promise.resolve());
  }
});

// ── Manual mutation queue: page-side enqueues, SW flushes on sync/online ─────
// Pages that perform local writes can enqueue an opaque mutation record into
// IndexedDB ('nv-mutation-queue' store, key-path 'id'); the SW will POST each
// one to /api/sync/push when the browser fires a 'sync' event for our tag, or
// on 'online' as a fallback for browsers without BackgroundSync (Safari/iOS).
const SYNC_QUEUE_TAG = 'nomadvault-sync-queue';
const MUTATION_DB    = 'nv-mutations';
const MUTATION_STORE = 'nv-mutation-queue';

function openMutationDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MUTATION_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        db.createObjectStore(MUTATION_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function readAllMutations(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(MUTATION_STORE, 'readonly');
    const store = tx.objectStore(MUTATION_STORE);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(MUTATION_STORE, 'readwrite');
    const req = tx.objectStore(MUTATION_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function flushMutationQueue() {
  let db;
  try {
    db = await openMutationDb();
  } catch {
    return;
  }
  const items = await readAllMutations(db).catch(() => []);
  for (const item of items) {
    try {
      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item.payload),
        credentials: 'include',
      });
      if (res.ok) {
        await deleteMutation(db, item.id);
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        // 4xx (other than throttling/timeout) won't succeed on retry — drop to
        // avoid an infinite retry loop. Notify the page so it can surface it.
        await deleteMutation(db, item.id);
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const c of clients) c.postMessage({ type: 'SYNC_DROPPED', id: item.id, status: res.status });
      } else {
        // 5xx / network — leave in queue, will retry on next sync/online
        throw new Error(`retryable ${res.status}`);
      }
    } catch {
      // Stop on first retryable failure so we don't burn through the queue
      // when offline; remaining items will retry on the next event.
      break;
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_QUEUE_TAG) {
    event.waitUntil(flushMutationQueue());
  }
});

// Fallback for browsers without BackgroundSync (notably iOS Safari).
self.addEventListener('online', () => {
  flushMutationQueue();
});

// Manual flush trigger from the page (e.g., after enqueueing a mutation).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'TRIGGER_SYNC_FLUSH') {
    event.waitUntil(flushMutationQueue());
  }
});

// ── Catch handler: return cached shell for navigation failures ─────────────────
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const cached = await caches.match('/');
    return cached ?? Response.error();
  }
  return Response.error();
});
