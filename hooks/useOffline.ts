'use client';

import { useEffect, useState } from 'react';

export interface OfflineState {
  online: boolean;
  since: string | null;
}

export function useOffline(): OfflineState {
  const [state, setState] = useState<OfflineState>(() => ({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    since: null,
  }));

  useEffect(() => {
    const mark = (online: boolean) =>
      setState({ online, since: new Date().toISOString() });

    const onOnline  = () => mark(true);
    const onOffline = () => mark(false);

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    // 30s ping heartbeat to /api/health
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
        mark(res.ok);
      } catch {
        mark(false);
      }
    }, 30_000);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, []);

  return state;
}
