'use client';

import { useState, useCallback } from 'react';
import { Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import type { ParsedEvent, Trip } from '@/lib/schema';

interface PasteParseModalProps {
  open: boolean;
  onClose: () => void;
  onParse: (rawText: string) => Promise<ParsedEvent[]>;
  onSave: (events: ParsedEvent[], tripId: string | null) => Promise<void>;
  trips: Trip[];
}

type Step = 'input' | 'parsing' | 'preview' | 'saving';

function FieldRow({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-2 text-sm">
      <span className="pt-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="glass-inset rounded-lg border border-subtle px-3 py-2 text-ink focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function EventPreviewCard({
  event,
  index,
  onChange,
}: {
  event: ParsedEvent;
  index: number;
  onChange: (updated: ParsedEvent) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const update = (field: keyof ParsedEvent, value: string) =>
    onChange({ ...event, [field]: value || null });

  const confidenceColor =
    event.confidence >= 0.8 ? 'text-success' : event.confidence >= 0.6 ? 'text-warning' : 'text-danger';

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold uppercase text-primary">
            {event.type}
          </span>
          <span className="text-sm text-ink">{event.locationName ?? event.provider ?? `Event ${index + 1}`}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-medium', confidenceColor)}>
            {Math.round(event.confidence * 100)}%
          </span>
          {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-subtle p-3">
          <FieldRow label="Location"     value={event.locationName}      onChange={(v) => update('locationName', v)} />
          <FieldRow label="Provider"     value={event.provider}          onChange={(v) => update('provider', v)} />
          <FieldRow label="Start"        value={event.startDatetime}     onChange={(v) => update('startDatetime', v)} />
          <FieldRow label="End"          value={event.endDatetime}       onChange={(v) => update('endDatetime', v)} />
          <FieldRow label="Confirmation" value={event.confirmationNumber} onChange={(v) => update('confirmationNumber', v)} />
          <FieldRow label="PNR"          value={event.pnr}               onChange={(v) => update('pnr', v)} />
        </div>
      )}
    </div>
  );
}

export default function PasteParseModal({ open, onClose, onParse, onSave, trips }: PasteParseModalProps) {
  const [step, setStep]       = useState<Step>('input');
  const [rawText, setRawText] = useState('');
  const [events, setEvents]   = useState<ParsedEvent[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(trips[0]?.id ?? null);
  const [newTripTitle, setNewTripTitle]     = useState('');

  const handleParse = useCallback(async () => {
    if (!rawText.trim()) return;
    setStep('parsing');
    setError(null);
    try {
      const result = await onParse(rawText);
      setEvents(result);
      setStep('preview');
    } catch (e) {
      setError(String(e));
      setStep('input');
    }
  }, [rawText, onParse]);

  const handleSave = useCallback(async () => {
    setStep('saving');
    try {
      const tripId = selectedTripId === '__new__'
        ? null
        : selectedTripId;
      await onSave(events, tripId);
      onClose();
    } catch (e) {
      setError(String(e));
      setStep('preview');
    }
  }, [events, selectedTripId, onSave, onClose]);

  const updateEvent = useCallback((i: number, updated: ParsedEvent) => {
    setEvents((prev) => prev.map((e, idx) => (idx === i ? updated : e)));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <div className="glass flex items-center justify-between px-4 py-3 safe-area-top">
        <h2 className="text-base font-semibold text-ink">Paste & Parse</h2>
        <button onClick={onClose} className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-black/[0.06]">
          <X size={18} className="text-muted" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {(step === 'input' || step === 'parsing') && (
          <>
            <p className="text-sm text-muted">
              Paste a booking confirmation email below. Works offline — no data is sent unless you have AI enabled.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste email text here…"
              rows={12}
              className="glass-inset w-full rounded-xl border border-subtle p-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none resize-none"
              disabled={step === 'parsing'}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}

        {(step === 'preview' || step === 'saving') && (
          <>
            {events.length === 0 ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                No travel events detected. Try a different email or paste more context.
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">{events.length} event{events.length > 1 ? 's' : ''} detected. Review and edit before saving.</p>
                {events.map((ev, i) => (
                  <EventPreviewCard key={i} event={ev} index={i} onChange={(u) => updateEvent(i, u)} />
                ))}
              </>
            )}

            {/* Trip selector */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Add to trip</p>
              <select
                value={selectedTripId ?? '__new__'}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="glass-inset w-full rounded-xl border border-subtle px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              >
                <option value="__new__">+ Create new trip</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {selectedTripId === '__new__' && (
              <input
                value={newTripTitle}
                onChange={(e) => setNewTripTitle(e.target.value)}
                placeholder="New trip name…"
                className="glass-inset w-full rounded-xl border border-subtle px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}
      </div>

      {/* Footer CTA */}
      <div className="glass safe-area-bottom flex gap-3 px-4 py-3 border-t border-subtle">
        {step === 'input' && (
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="touch-target flex-1 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-40"
          >
            Parse
          </button>
        )}

        {step === 'parsing' && (
          <div className="flex flex-1 items-center justify-center gap-2 py-3 text-muted">
            <Loader2 size={16} className="animate-spin" />
            Parsing…
          </div>
        )}

        {(step === 'preview' || step === 'saving') && (
          <>
            <button
              onClick={() => setStep('input')}
              className="touch-target rounded-xl bg-black/[0.06] px-4 py-3 text-sm text-muted hover:bg-black/[0.10]"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={step === 'saving' || events.length === 0}
              className="touch-target flex-1 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-40"
            >
              {step === 'saving' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </span>
              ) : (
                'Save to trip'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
