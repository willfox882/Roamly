'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, ShieldAlert } from 'lucide-react';
import { db, wipeAll } from '@/lib/db';
import { useUIStore } from '@/lib/store';
import SettingsPanel from '@/app/components/SettingsPanel';

const MUTATION_DB = 'nv-mutations'; // SW background-sync queue (see public/sw.js)

async function clearMutationQueue(): Promise<void> {
  // Best-effort: the SW-owned IndexedDB used for offline mutation flushing.
  // Wrapped so the deletion flow doesn't fail if the DB was never created.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(MUTATION_DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

export type DeleteAccountOpts = {
  alsoDeleteLocalBackups: boolean;
};

interface DeleteAccountSectionProps {
  onDelete: (opts: DeleteAccountOpts) => Promise<void>;
}

/**
 * Two-step destructive action: open confirmation → choose whether to also
 * wipe local backup metadata → confirm. Exported so the unit test can drive
 * the UI flow without spinning up the whole settings page (which depends on
 * Dexie hooks).
 */
export function DeleteAccountSection({ onDelete }: DeleteAccountSectionProps) {
  const [open,        setOpen]        = useState(false);
  const [alsoBackups, setAlsoBackups] = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setError(null); }}
        className="flex items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
      >
        <ShieldAlert size={14} />
        Delete Account &amp; Cloud Data
      </button>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-acct-title" className="space-y-3">
      <p id="delete-acct-title" className="text-sm font-semibold text-danger">
        This will permanently delete your account, all encrypted cloud data, and every local trip on this device. It cannot be undone.
      </p>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={alsoBackups}
          onChange={(e) => setAlsoBackups(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-danger"
          aria-label="Also delete local backup files"
        />
        <span>Also delete local backup files. (Default keeps backups so you can restore if you change your mind.)</span>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onDelete({ alsoDeleteLocalBackups: alsoBackups });
              setOpen(false);
            } catch (e) {
              setError((e as Error).message || 'Deletion failed');
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Confirm permanent deletion'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          disabled={busy}
          className="rounded-lg bg-black/[0.06] px-3 py-2 text-sm text-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const aiConsent = useUIStore((s) => s.aiConsent);
  const setAiConsent = useUIStore((s) => s.setAiConsent);

  const [confirmWipe, setConfirmWipe] = useState(false);

  const tripCount   = useLiveQuery(() => db.trips.count(),    []) ?? 0;
  const eventCount  = useLiveQuery(() => db.events.count(),   []) ?? 0;
  const pinCount    = useLiveQuery(() => db.bucketPins.count(), []) ?? 0;

  return (
    <div className="space-y-4 px-4 py-4">
      <h1 className="text-xl font-bold text-ink">Settings</h1>

      {/* Theme */}
      <SettingsPanel title="Appearance">
        <div className="flex gap-2">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-pill px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                theme === t ? 'bg-primary text-white' : 'bg-black/[0.06] text-muted hover:bg-black/[0.10]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </SettingsPanel>

      {/* AI provider */}
      <SettingsPanel
        title="AI Provider"
        description="Choose how trip emails are parsed. Local-only is always available."
      >
        <label className="flex items-center justify-between">
          <span className="text-sm text-ink">Enable AI parsing</span>
          <input
            type="checkbox"
            checked={aiConsent.enabled}
            onChange={(e) => setAiConsent({ ...aiConsent, enabled: e.target.checked })}
            className="h-5 w-5 accent-primary"
          />
        </label>

        {aiConsent.enabled && (
          <div className="flex flex-wrap gap-2 pt-1">
            {(['cloud', 'free', 'local', 'none'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAiConsent({ ...aiConsent, provider: p })}
                className={`rounded-pill px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  aiConsent.provider === p
                    ? 'bg-primary text-white'
                    : 'bg-black/[0.06] text-muted hover:bg-black/[0.10]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </SettingsPanel>

      {/* Privacy */}
      <SettingsPanel title="Privacy" description="Everything is stored locally. Sensitive fields are encrypted before any sync.">
        <ul className="space-y-1 text-sm text-muted">
          <li>• Confirmation numbers and PNRs are encrypted in transit</li>
          <li>• No data leaves your device unless you enable sync</li>
          <li>• AI parsing only occurs if you explicitly enable it above</li>
        </ul>
      </SettingsPanel>

      {/* Health */}
      <SettingsPanel title="Health">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Trips</span>
            <span className="text-ink">{tripCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Events</span>
            <span className="text-ink">{eventCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Bucket pins</span>
            <span className="text-ink">{pinCount}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          iOS Safari may evict IndexedDB after ~7 days of inactivity. Set up scheduled backups to protect your data.
        </p>
      </SettingsPanel>

      {/* Danger zone */}
      <SettingsPanel title="Danger Zone" danger>
        <DeleteAccountSection
          onDelete={async ({ alsoDeleteLocalBackups }) => {
            // 1. Best-effort cloud delete. Any failure here surfaces in the
            //    section's error slot so the user can retry or cancel.
            const res = await fetch('/api/account', {
              method:  'DELETE',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
            });
            if (!res.ok && res.status !== 401) {
              // 401 means we never had a cloud account (no token) — proceed
              // to the local wipe regardless. Any other failure aborts.
              throw new Error(`Cloud delete failed: HTTP ${res.status}`);
            }
            // 2. Always clear the SW mutation queue so a deferred POST doesn't
            //    resurrect data on the server immediately after deletion.
            await clearMutationQueue();
            // 3. Wipe Dexie. wipeAll() already includes backupsMeta; if the
            //    user chose NOT to delete local backups, we re-import the
            //    metadata captured before the wipe.
            const preservedBackups = alsoDeleteLocalBackups
              ? []
              : await db.backupsMeta.toArray();
            await wipeAll();
            if (preservedBackups.length > 0) {
              await db.backupsMeta.bulkAdd(preservedBackups);
            }
          }}
        />
        <div className="mt-3 border-t border-white/10 pt-3" />
        {!confirmWipe ? (
          <button
            onClick={() => setConfirmWipe(true)}
            className="flex items-center gap-2 rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
          >
            <Trash2 size={14} />
            Delete all local data
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-danger">This cannot be undone. All local data will be erased.</p>
            <div className="flex gap-2">
              <button
                onClick={async () => { await wipeAll(); setConfirmWipe(false); }}
                className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white"
              >
                Confirm delete
              </button>
              <button
                onClick={() => setConfirmWipe(false)}
                className="rounded-lg bg-black/[0.06] px-3 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
