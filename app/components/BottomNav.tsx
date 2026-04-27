'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, Plus, Bookmark, Settings, type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface TabDef {
  href: string;
  Icon: LucideIcon;
  label: string;
  center?: boolean;
}

const TABS: TabDef[] = [
  { href: '/',          Icon: Home,     label: 'Home'     },
  { href: '/map',       Icon: Map,      label: 'Map'      },
  { href: '/add/parse', Icon: Plus,     label: 'Add',     center: true },
  { href: '/bucket',    Icon: Bookmark, label: 'Bucket'   },
  { href: '/settings',  Icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass safe-area-bottom fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-subtle px-2">
      {TABS.map(({ href, Icon, label, center }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));

        if (center) {
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="touch-target relative -mt-5 flex h-14 w-14 items-center justify-center rounded-pill bg-primary shadow-card transition-transform active:scale-95"
            >
              <Icon size={24} className="text-white" />
            </Link>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="touch-target relative flex flex-col items-center justify-center gap-0.5 px-3"
          >
            <Icon size={22} className={clsx(active ? 'text-primary' : 'text-muted')} />
            <span className={clsx('text-[10px]', active ? 'text-primary' : 'text-muted')}>
              {label}
            </span>
            {active && (
              <motion.span
                layoutId="nav-indicator"
                className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
