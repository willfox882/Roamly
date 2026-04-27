'use client';

import { useRef, useState } from 'react';
import { X, Loader2, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { exportAll } from '@/lib/backup';
import { useBackup } from '@/hooks/useBackup';
import type { ImportReport } from '@/lib/schema';

type Tab = 'export' | 'import';
type ImportMode = 'merge' | 'overwrite' | 'dry_run';

interface Props {
  open: boolean;
  onClose(): void;
}

function ReportPreview({ report }: { report: ImportReport }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm space-y-1">
      <p className="font-medium text-white">{report.dryRun ? 'Dry-run preview' : 'Import complete'}</p>
      <p className="text-muted">Will add: <span className="text-success">{report.added}</span></p>
      <p className="text-muted">Will replace: <span className="text-warning">{report.replaced}</span></p>
      <p className="text-muted">Unchanged: <span className="text-muted">{report.skipped}</span></p>
      {report.snapshotId && (
        <p className="text-xs text-muted mt-1">Snapshot ID: {report.snapshotId.slice(0, 8)}…</p>
      )}
    </div>
  );
}

export default function ExportImportModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('export');
  const [passphrase, setPassphrase] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { importFile } = useBackup();

  if (!open) return null;

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      await exportAll({ passphrase: passphrase || undefined });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (applyMode: ImportMode) => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await importFile(selectedFile, {
        passphrase: passphrase || undefined,
        mode: applyMode,
      });
      setReport(result);
      if (!result.dryRun) setTimeout(onClose, 1500);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-dark">
      {/* Header */}
      <div className="glass flex items-center justify-between px-4 py-3 safe-area-top">
        <h2 className="text-base font-semibold text-white">Export / Import</h2>
        <button onClick={onClose} className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-white/10">
          <X size={18} className="text-muted" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {(['export', 'import'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(null); setReport(null); }}
            className={clsx(
              'flex-1 py-2.5 text-sm font-medium capitalize transition',
              tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Passphrase (shared) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            <ShieldCheck size={11} className="mr-1 inline" />
            Passphrase (optional — encrypts the backup)
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Leave blank for unencrypted"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {tab === 'export' && (
          <p className="text-sm text-muted">
            Exports all local trips, events, and bucket pins to a JSON file. Add a passphrase to encrypt with AES-GCM-256.
          </p>
        )}

        {tab === 'import' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Backup file</label>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.nomadvault"
                onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setReport(null); }}
                className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {(['merge', 'overwrite', 'dry_run'] as ImportMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setImportMode(m)}
                    className={clsx(
                      'rounded-xl border py-2 text-xs font-medium transition',
                      importMode === m
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-white/10 bg-white/5 text-muted hover:bg-white/10',
                    )}
                  >
                    {m === 'dry_run' ? 'Dry run' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {importMode === 'merge' && 'Keeps newer records from either side (LWW).'}
                {importMode === 'overwrite' && 'Replaces all local data with the backup.'}
                {importMode === 'dry_run' && 'Preview changes without writing anything.'}
              </p>
            </div>

            {report && <ReportPreview report={report} />}
          </>
        )}

        {error && <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      </div>

      {/* Footer */}
      <div className="glass safe-area-bottom flex gap-3 border-t border-white/10 px-4 py-3">
        {tab === 'export' && (
          <button
            onClick={handleExport}
            disabled={loading}
            className="touch-target flex-1 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-40"
          >
            {loading ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'Export'}
          </button>
        )}

        {tab === 'import' && (
          <>
            {importMode === 'dry_run' ? (
              <button
                onClick={() => handleImport('dry_run')}
                disabled={!selectedFile || loading}
                className="touch-target flex-1 rounded-xl bg-white/10 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {loading ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'Preview'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleImport('dry_run')}
                  disabled={!selectedFile || loading}
                  className="touch-target rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-muted disabled:opacity-40"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleImport(importMode)}
                  disabled={!selectedFile || loading}
                  className={clsx(
                    'touch-target flex-1 rounded-xl py-3 font-semibold text-white disabled:opacity-40',
                    importMode === 'overwrite' ? 'bg-danger' : 'bg-primary',
                  )}
                >
                  {loading ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'Apply'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
