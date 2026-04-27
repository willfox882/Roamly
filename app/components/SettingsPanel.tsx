'use client';

import { clsx } from 'clsx';

interface SettingsPanelProps {
  title: string;
  description?: string;
  danger?: boolean;
  children?: React.ReactNode;
}

export default function SettingsPanel({ title, description, danger, children }: SettingsPanelProps) {
  return (
    <section
      className={clsx(
        'rounded-xl border p-4',
        danger
          ? 'border-danger/30 bg-danger/5'
          : 'border-subtle bg-card',
      )}
    >
      <div className="mb-3">
        <h2 className={clsx('text-base font-semibold', danger ? 'text-danger' : 'text-ink')}>
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
