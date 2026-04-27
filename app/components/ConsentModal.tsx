'use client';

import { ShieldCheck } from 'lucide-react';

interface Props {
  open: boolean;
  onAgree(): void;
  onDecline(): void;
}

export default function ConsentModal({ open, onAgree, onDecline }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={20} className="text-primary" aria-hidden="true" />
          <h2 id="consent-modal-title" className="text-base font-semibold text-white">
            AI parsing consent
          </h2>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-muted">
          Roamly can extract itinerary details from your confirmation emails by sending the
          text to a third&#8209;party AI provider. This may include personal data (names,
          booking refs). Do you consent?
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/5"
          >
            Use Manual Entry
          </button>
          <button
            type="button"
            onClick={onAgree}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Agree
          </button>
        </div>
      </div>
    </div>
  );
}
