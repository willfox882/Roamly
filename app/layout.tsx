'use client';

import './globals.css';
import { Providers } from '@/app/components/Providers';
import { useUIStore } from '@/lib/store';
import { useEffect, useState } from 'react';

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <html lang="en" className={mounted && theme === 'dark' ? 'dark' : ''}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('roamly:theme');
                  var supportDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && supportDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-surface text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <ThemeWrapper>{children}</ThemeWrapper>;
}
