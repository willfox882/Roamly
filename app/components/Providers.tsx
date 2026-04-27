'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useUIStore } from '@/lib/store';
import Header from '@/app/components/Header';
import BottomNav from '@/app/components/BottomNav';

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}

function ThemeApplier() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('dark', 'light');
    }
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Each client gets its own QueryClient — avoid shared state between requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeApplier />
      <ServiceWorkerRegistrar />
      <div className="flex min-h-dvh flex-col">
        <Header />
        {/* pb-16 leaves room for the fixed BottomNav */}
        <main className="flex-1 pb-16">{children}</main>
        <BottomNav />
      </div>
    </QueryClientProvider>
  );
}
