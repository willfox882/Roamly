'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import type { Gap } from '@/lib/schema';

interface GapAlertProps {
  gap: Gap;
  onAction?: (actionId: string) => void;
}

const severityConfig = {
  high:   { Icon: AlertTriangle, ring: 'border-danger/40',  bg: 'bg-danger/10',  text: 'text-danger'  },
  medium: { Icon: AlertCircle,   ring: 'border-warning/40', bg: 'bg-warning/10', text: 'text-warning' },
  low:    { Icon: Info,          ring: 'border-subtle',     bg: 'bg-card',       text: 'text-muted'   },
} as const;

export default function GapAlert({ gap, onAction }: GapAlertProps) {
  const { Icon, ring, bg, text } = severityConfig[gap.severity];

  return (
    <div className={clsx('rounded-xl border p-3', ring, bg)}>
      <div className="flex items-start gap-2">
        <Icon size={16} className={clsx('mt-0.5 shrink-0', text)} />
        <p className="flex-1 text-sm text-ink/90">{gap.message}</p>
      </div>

      {gap.suggestedActions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {gap.suggestedActions.map((action) => (
            <button
              key={action.actionId}
              onClick={() => onAction?.(action.actionId)}
              className={clsx(
                'touch-target rounded-pill border px-3 py-1 text-xs font-medium transition-colors',
                ring,
                text,
                'hover:bg-black/[0.06]',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
