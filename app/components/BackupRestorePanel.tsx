'use client';

import { useState } from 'react';
import { HardDrive, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useBackup } from '@/hooks/useBackup';
import ExportImportModal from '@/app/components/ExportImportModal';
import type { BackupMeta } from '@/lib/schema';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function BackupRow({
  meta,
  onRestore,
}: {
  meta: BackupMeta;
  onRestore: (meta: BackupMeta) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-white">
          {formatDate(meta.createdAt)}
          {meta.encrypted && (
            <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary">🔒</span>
          )}
        </p>
        <p className="text-xs text-muted">
          {formatBytes(meta.size)} · {meta.destination}
        </p>
      </div>
      <button
        onClick={() => onRestore(meta)}
        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
      >
        Restore
      </button>
    </div>
  );
}

export default function BackupRestorePanel() {
  const { listLocal, lastBackupAt, daysSinceLastBackup, loading, exportNow, setSchedule, refresh } =
    useBackup();
  const [showModal, setShowModal] = useState(false);
  const [cadence, setCadence] = useState<'off' | 'daily' | 'weekly' | 'monthly'>('off');
  const [destination, setDestination] = useState<'download' | 'supabase' | 's3' | 'gdrive'>('download');
  const [restoreTarget, setRestoreTarget] = useState<BackupMeta | null>(null);

  const handleScheduleSave = async () => {
    await setSchedule(cadence, destination);
  };

  const urgentBackup = daysSinceLastBackup !== null && daysSinceLastBackup > 7;

  return (
    <div className="space-y-4">
      {/* Status */}
      <div
        className={clsx(
          'flex items-start gap-3 rounded-xl border p-3',
          urgentBackup ? 'border-danger/30 bg-danger/5' : 'border-white/10 bg-white/5',
        )}
      >
        {urgentBackup ? (
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
        ) : (
          <HardDrive size={18} className="mt-0.5 shrink-0 text-success" />
        )}
        <div className="text-sm">
          <p className="font-medium text-white">
            {lastBackupAt ? `Last backup: ${formatDate(lastBackupAt)}` : 'No backup yet'}
          </p>
          {daysSinceLastBackup !== null && (
            <p className={clsx('text-xs', urgentBackup ? 'text-danger' : 'text-muted')}>
              {daysSinceLastBackup === 0 ? 'Today' : `${daysSinceLastBackup} day${daysSinceLastBackup > 1 ? 's' : ''} ago`}
            </p>
          )}
          {urgentBackup && (
            <p className="mt-1 text-xs text-danger">
              ⚠️ iOS Safari may evict IndexedDB after 7+ days inactivity. Back up now!
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => exportNow()}
          disabled={loading}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loading ? 'Working…' : 'Back up now'}
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-muted hover:bg-white/20"
        >
          Import
        </button>
      </div>

      {/* Schedule */}
      <div className="rounded-xl border border-white/10 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Clock size={14} />
          Scheduled backups
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Frequency</label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as typeof cadence)}
              className="w-full rounded-lg border border-white/10 bg-surface-dark px-2 py-1.5 text-sm text-white"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Destination</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as typeof destination)}
              className="w-full rounded-lg border border-white/10 bg-surface-dark px-2 py-1.5 text-sm text-white"
            >
              <option value="download">Download</option>
              <option value="supabase">Supabase</option>
              <option value="s3">S3</option>
              <option value="gdrive">Google Drive</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleScheduleSave}
          className="w-full rounded-xl bg-white/10 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          Save schedule
        </button>
      </div>

      {/* Backups list */}
      {listLocal.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Local backups ({listLocal.length})
          </p>
          {listLocal.map((meta) => (
            <BackupRow key={meta.id} meta={meta} onRestore={setRestoreTarget} />
          ))}
        </div>
      )}

      {/* Restore confirmation */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass w-full max-w-sm rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-white">
              <RotateCcw size={18} />
              <span className="font-semibold">Restore backup?</span>
            </div>
            <p className="text-sm text-muted">
              A snapshot of current data will be created automatically before restoring.
            </p>
            <p className="text-xs text-muted font-mono break-all">
              {restoreTarget.sha256.slice(0, 16)}…
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRestoreTarget(null)}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setRestoreTarget(null);
                  await refresh();
                }}
                className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-semibold text-white"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportImportModal open={showModal} onClose={() => { setShowModal(false); void refresh(); }} />
    </div>
  );
}
