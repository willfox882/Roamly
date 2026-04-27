'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Sun, Moon } from 'lucide-react';
import { useUIStore } from '@/lib/store';
import { useSync } from '@/hooks/useSync';
import { useOffline } from '@/hooks/useOffline';

function ThemeToggle() {
  const { theme, setTheme } = useUIStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('roamly:theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={toggleTheme}
      className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-black/[0.06] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-warning" />
      ) : (
        <Moon size={18} className="text-muted" />
      )}
    </button>
  );
}

function SyncPill() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { status, lastSyncAt } = useSync();

  if (!mounted) return null;

  if (status === 'syncing') {
    return (
      <span className="flex items-center gap-1 rounded-pill bg-primary/20 px-2 py-0.5 text-xs text-primary">
        <RefreshCw size={10} className="animate-spin" />
        Syncing
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 rounded-pill bg-danger/20 px-2 py-0.5 text-xs text-danger">
        <AlertCircle size={10} />
        Sync error
      </span>
    );
  }
  if (lastSyncAt) {
    try {
      const rel = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
      const diff = Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60_000);
      const label = diff < 1 ? 'just now' : rel.format(-diff, 'minute');
      return (
        <span className="rounded-pill bg-black/[0.06] px-2 py-0.5 text-xs text-muted">
          {label}
        </span>
      );
    } catch {
      return (
        <span className="rounded-pill bg-black/[0.06] px-2 py-0.5 text-xs text-muted">
          Synced
        </span>
      );
    }
  }
  return null;
}

export default function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { online } = useOffline();

  return (
    <>
      {/* Offline banner — only rendered after mount so server/client HTML matches */}
      {mounted && !online && (
        <div className="flex items-center justify-center gap-1.5 bg-danger py-1 text-xs font-medium text-white">
          <WifiOff size={12} />
          You&rsquo;re offline — viewing cached data
        </div>
      )}

      <header className="glass safe-area-top sticky top-0 z-40 flex h-11 items-center justify-between px-4">
        <Link href="/" className="text-base font-bold tracking-tight text-ink hover:opacity-70 transition-opacity active:scale-95">
          Roamly
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SyncPill />
          {mounted ? (
            online ? (
              <Wifi size={14} className="text-success" />
            ) : (
              <WifiOff size={14} className="text-danger" />
            )
          ) : (
            <Wifi size={14} className="text-muted" />
          )}
        </div>
      </header>
    </>
  );
}
