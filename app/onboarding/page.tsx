'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Map, Zap, Shield, Cpu, Cloud, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/lib/store';

type Step = 'welcome' | 'privacy' | 'ai' | 'seed';

const FEATURES = [
  { icon: Map,   title: 'Visual timeline',   desc: 'All your trips on one map + timeline.' },
  { icon: Zap,   title: 'Gap detection',      desc: 'Instantly spots missing hotels, flights, confirmations.' },
  { icon: Globe, title: 'Lowkey recs',        desc: 'Off-the-beaten-path suggestions, not tourist traps.' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const setAiConsent = useUIStore((s) => s.setAiConsent);
  const [step, setStep] = useState<Step>('welcome');
  const [seedDone, setSeedDone] = useState(false);

  const advance = (next: Step | 'done') => {
    if (next === 'done') { router.push('/'); return; }
    setStep(next);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between px-6 py-10">
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="flex w-full max-w-sm flex-col gap-6"
          >
            <div className="text-center">
              <Globe size={48} className="mx-auto mb-3 text-primary" />
              <h1 className="text-3xl font-bold text-ink">Roamly</h1>
              <p className="mt-2 text-muted">Your private, offline-first travel dashboard.</p>
            </div>

            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="glass flex items-start gap-3 rounded-xl p-3">
                  <Icon size={20} className="mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => advance('privacy')}
              className="touch-target w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition active:scale-95"
            >
              Get started
            </button>
          </motion.div>
        )}

        {step === 'privacy' && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="flex w-full max-w-sm flex-col gap-6"
          >
            <div className="text-center">
              <Shield size={48} className="mx-auto mb-3 text-success" />
              <h2 className="text-2xl font-bold text-ink">Privacy first</h2>
              <p className="mt-2 text-sm text-muted">Your data stays on your device by default. Nothing leaves unless you say so.</p>
            </div>

            <div className="glass rounded-xl p-4 text-sm text-muted space-y-2">
              <p>✓ All data stored locally in IndexedDB</p>
              <p>✓ Confirmation numbers encrypted before any sync</p>
              <p>✓ No ads, no tracking, no telemetry</p>
              <p>✓ Export everything, delete everything, anytime</p>
            </div>

            <button
              onClick={() => advance('ai')}
              className="touch-target w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition active:scale-95"
            >
              Understood — continue
            </button>
          </motion.div>
        )}

        {step === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="flex w-full max-w-sm flex-col gap-6"
          >
            <div className="text-center">
              <Cpu size={48} className="mx-auto mb-3 text-accent" />
              <h2 className="text-2xl font-bold text-ink">AI parsing</h2>
              <p className="mt-2 text-sm text-muted">Parse booking emails automatically. Always works offline with our built-in regex parser — AI is optional.</p>
            </div>

            <div className="space-y-2">
              {([
                { provider: 'none'  as const, icon: Shield, label: 'Local only (recommended)', desc: 'Regex parser, no network calls, fully private.' },
                { provider: 'cloud' as const, icon: Cloud,  label: 'Cloud AI (Anthropic)',       desc: 'Best accuracy. Sends email text to Anthropic API.' },
                { provider: 'local' as const, icon: Cpu,    label: 'Local LLM',                  desc: 'Your own llama.cpp / Ollama server.' },
              ] as const).map(({ provider, icon: Icon, label, desc }) => (
                <button
                  key={provider}
                  onClick={() => {
                    setAiConsent({ enabled: provider !== 'none', provider });
                    advance('seed');
                  }}
                  className="glass touch-target flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-black/[0.04] active:scale-[0.98] transition-transform"
                >
                  <Icon size={18} className="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'seed' && (
          <motion.div
            key="seed"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="flex w-full max-w-sm flex-col gap-6"
          >
            <div className="text-center">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-success" />
              <h2 className="text-2xl font-bold text-ink">Almost there!</h2>
              <p className="mt-2 text-sm text-muted">Load sample data to explore the app, or start fresh.</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={async () => {
                  const { runSeedInBrowser } = await import('@/seed/seed');
                  await runSeedInBrowser();
                  setSeedDone(true);
                  setTimeout(() => advance('done'), 600);
                }}
                className="touch-target w-full rounded-xl bg-primary py-3 text-center font-semibold text-white transition active:scale-95"
              >
                {seedDone ? '✓ Loaded!' : 'Load demo data'}
              </button>
              <button
                onClick={() => advance('done')}
                className="touch-target w-full rounded-xl bg-black/[0.06] py-3 text-center font-medium text-muted transition hover:bg-black/[0.10] active:scale-95"
              >
                Start fresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
