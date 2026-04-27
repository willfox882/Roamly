/**
 * Provider abstraction. Client-side calls go through /api/ai/* (key never leaves server).
 * Server-side calls use the Anthropic SDK directly.
 * Fallback chain: cloud → free → local → deterministic.
 */
import { ParsedEventSchema, RecommendationSchema } from '@/lib/schema';
import type { ParsedEvent, Recommendation } from '@/lib/schema';
import { parseEmail as deterministicParse } from '@/lib/parser';

export type ProviderMode = 'cloud' | 'free' | 'local' | 'auto' | 'none';

interface AiClientOpts {
  provider?: ProviderMode;
  signal?: AbortSignal;
  bustCache?: boolean;
  /** Per-provider timeout in milliseconds. Default 8s. */
  timeoutMs?: number;
}

/**
 * Confidence threshold below which a successful LLM response is treated as
 * "low confidence" and we drop to the deterministic parser instead. Mean
 * confidence across all events is used.
 */
const LOW_CONFIDENCE_THRESHOLD = 0.5;
const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000;

/**
 * Wraps an external signal with a timeout. Returns a combined signal that
 * aborts when either the caller cancels or the timeout fires, plus a cleanup
 * function. Uses AbortSignal.any when available, falls back to manual wiring
 * (Node 20 supports AbortSignal.any since 20.3).
 */
function withTimeout(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; clear: () => void; timedOut: () => boolean } {
  const ctrl = new AbortController();
  let didTimeout = false;
  const t = setTimeout(() => {
    didTimeout = true;
    ctrl.abort(new Error('AI_PROVIDER_TIMEOUT'));
  }, timeoutMs);
  const onExternal = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener('abort', onExternal, { once: true });
  }
  return {
    signal: ctrl.signal,
    clear: () => {
      clearTimeout(t);
      external?.removeEventListener('abort', onExternal);
    },
    timedOut: () => didTimeout,
  };
}

function meanConfidence(events: ParsedEvent[]): number {
  if (events.length === 0) return 0;
  return events.reduce((s, e) => s + (e.confidence ?? 0), 0) / events.length;
}

function markNeedsReview(events: ParsedEvent[]): ParsedEvent[] {
  return events.map((e) => ({ ...e, status: 'needs_review' as const }));
}

interface RecInput {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  exclusions: string[];
  preferences: Record<string, unknown>;
}

// ── Prompt templates (loaded lazily) ─────────────────────────────────────────

let _parseSystemPrompt:  string | null = null;
let _recommendSystemPrompt: string | null = null;

async function loadPrompt(name: string): Promise<string> {
  // Server: read from disk. Client: fetch from /config path (not served — shouldn't be called client-side).
  if (typeof window === 'undefined') {
    const fs   = await import('fs');
    const path = await import('path');
    return fs.readFileSync(path.join(process.cwd(), 'config', 'prompts', name), 'utf8');
  }
  const res = await fetch(`/config/prompts/${name}`);
  return res.text();
}

async function getParseSystemPrompt(): Promise<string> {
  if (!_parseSystemPrompt) _parseSystemPrompt = await loadPrompt('email_parse_system.txt');
  return _parseSystemPrompt;
}

async function getRecommendSystemPrompt(): Promise<string> {
  if (!_recommendSystemPrompt) _recommendSystemPrompt = await loadPrompt('lowkey_recommend_system.txt');
  return _recommendSystemPrompt;
}

// ── SHA-256 cache key ─────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Dexie AI cache ────────────────────────────────────────────────────────────

async function getCached(promptHash: string): Promise<unknown | null> {
  try {
    const { db } = await import('@/lib/db');
    const row = await db.aiCache.get(promptHash);
    if (!row) return null;
    const age = Date.now() - new Date(row.cachedAt).getTime();
    if (age > 24 * 60 * 60 * 1000) return null; // 24h TTL
    return row.result;
  } catch { return null; }
}

async function setCached(promptHash: string, result: unknown): Promise<void> {
  try {
    const { db } = await import('@/lib/db');
    await db.aiCache.put({ promptHash, result, cachedAt: new Date().toISOString() });
  } catch { /* ignore — cache is best-effort */ }
}

// ── Anthropic cloud provider ──────────────────────────────────────────────────

async function callCloud(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  signal?: AbortSignal,
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] ?? '' });

  const msg = await client.messages.create(
    {
      model,
      max_tokens: 2048,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          // @ts-expect-error — cache_control is valid in SDK but not yet reflected in types
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user',      content: userPrompt },
        { role: 'assistant', content: '[' }, // prefill to force JSON array
      ],
    },
    { signal },
  );

  const raw = msg.content[0];
  if (!raw || raw.type !== 'text') throw new Error('Unexpected cloud response');
  return '[' + raw.text; // re-prepend the prefill bracket
}

// ── OpenAI-compatible local/free provider ─────────────────────────────────────

async function callOpenAICompat(
  baseUrl: string,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Local LLM HTTP ${res.status}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty local LLM response');
  return content;
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function extractJsonArray(raw: string): unknown[] {
  // Strip markdown code fences if present
  const stripped = raw.replace(/```(?:json)?/gi, '').trim();
  // Find the first '[' and last ']'
  const start = stripped.indexOf('[');
  const end   = stripped.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('No JSON array in response');
  return JSON.parse(stripped.slice(start, end + 1)) as unknown[];
}

// ── parseEmail ────────────────────────────────────────────────────────────────

export async function parseEmail(
  rawText: string,
  opts: AiClientOpts = {},
): Promise<ParsedEvent[]> {
  const mode = opts.provider ?? (process.env['AI_PROVIDER'] as ProviderMode | undefined) ?? 'none';

  const systemPrompt = await getParseSystemPrompt().catch(() => '');
  const userPrompt   = `Parse this booking confirmation email:\n\n${rawText}`;
  const cacheKey     = await sha256hex(systemPrompt + userPrompt);

  if (!opts.bustCache) {
    const cached = await getCached(cacheKey);
    if (cached) {
      const r = ParsedEventSchema.array().safeParse(cached);
      if (r.success) return r.data;
    }
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  const tryProvider = async (p: ProviderMode): Promise<ParsedEvent[] | null> => {
    const guard = withTimeout(opts.signal, timeoutMs);
    try {
      let raw: string;
      if (p === 'cloud') {
        const model = process.env['ANTHROPIC_PARSE_MODEL'] ?? 'claude-haiku-4-5-20251001';
        raw = await callCloud(systemPrompt, userPrompt, model, guard.signal);
      } else if (p === 'local') {
        const url = process.env['LOCAL_LLM_URL'] ?? 'http://localhost:8080/v1';
        raw = await callOpenAICompat(url, systemPrompt, userPrompt, guard.signal);
      } else if (p === 'free') {
        const url = process.env['FREE_LLM_URL'] ?? '';
        if (!url) return null;
        raw = await callOpenAICompat(url, systemPrompt, userPrompt, guard.signal);
      } else {
        return null;
      }

      const arr  = extractJsonArray(raw);
      const validated = ParsedEventSchema.array().safeParse(arr);
      if (!validated.success) return null;

      // Low-confidence response: treat as failed so we drop to deterministic
      // and surface needsReview to the caller.
      if (meanConfidence(validated.data) < LOW_CONFIDENCE_THRESHOLD) return null;

      return validated.data;
    } catch {
      // Timeout or any error — caller fall-through path will handle.
      return null;
    } finally {
      guard.clear();
    }
  };

  const chain: ProviderMode[] = mode === 'auto'
    ? ['cloud', 'free', 'local']
    : mode === 'none' ? [] : [mode];

  for (const p of chain) {
    const result = await tryProvider(p);
    if (result) {
      await setCached(cacheKey, result);
      return result;
    }
  }

  // Final fallback — always available deterministic parser. If we attempted
  // any AI provider and all failed/low-confidence/timed-out, mark the
  // resulting events as needs_review so the UI can prompt the user to verify.
  const det = deterministicParse(rawText);
  return chain.length > 0 ? markNeedsReview(det) : det;
}

// ── recommend ─────────────────────────────────────────────────────────────────

export async function recommend(
  input: RecInput,
  opts: AiClientOpts = {},
): Promise<Recommendation[]> {
  const mode = opts.provider ?? (process.env['AI_PROVIDER'] as ProviderMode | undefined) ?? 'none';
  if (mode === 'none') return [];

  const systemPrompt = await getRecommendSystemPrompt().catch(() => '');
  const userPrompt   = JSON.stringify({
    location: { lat: input.lat, lng: input.lng },
    dateRange: { start: input.startDate, end: input.endDate },
    exclusions: input.exclusions,
    preferences: input.preferences,
  });
  const cacheKey = await sha256hex(systemPrompt + userPrompt);

  if (!opts.bustCache) {
    const cached = await getCached(cacheKey);
    if (cached) {
      const r = RecommendationSchema.array().safeParse(cached);
      if (r.success) return r.data;
    }
  }

  const tryProvider = async (p: ProviderMode): Promise<Recommendation[] | null> => {
    try {
      let raw: string;
      if (p === 'cloud') {
        const model = process.env['ANTHROPIC_RECOMMEND_MODEL'] ?? 'claude-sonnet-4-6';
        raw = await callCloud(systemPrompt, userPrompt, model, opts.signal);
      } else if (p === 'local') {
        const url = process.env['LOCAL_LLM_URL'] ?? 'http://localhost:8080/v1';
        raw = await callOpenAICompat(url, systemPrompt, userPrompt, opts.signal);
      } else if (p === 'free') {
        const url = process.env['FREE_LLM_URL'] ?? '';
        if (!url) return null;
        raw = await callOpenAICompat(url, systemPrompt, userPrompt, opts.signal);
      } else {
        return null;
      }

      // Map AI output fields to our schema
      const arr = extractJsonArray(raw);
      const mapped = (arr as Record<string, unknown>[]).map((item, i) => ({
        id:          String(item['id'] ?? i),
        name:        String(item['name'] ?? ''),
        category:    String(item['category'] ?? 'other'),
        lat:         typeof item['lat'] === 'number' ? item['lat'] : undefined,
        lng:         typeof item['lng'] === 'number' ? item['lng'] : undefined,
        description: String(item['short_description'] ?? item['description'] ?? ''),
        reasoning:   String(item['why_it_is_lowkey'] ?? item['reasoning'] ?? ''),
        confidence:  typeof item['confidence'] === 'number' ? item['confidence'] : 0.7,
      }));

      const validated = RecommendationSchema.array().safeParse(mapped);
      if (!validated.success) return null;
      return validated.data;
    } catch { return null; }
  };

  const chain: ProviderMode[] = mode === 'auto' ? ['cloud', 'free', 'local'] : [mode];

  for (const p of chain) {
    const result = await tryProvider(p);
    if (result) {
      await setCached(cacheKey, result);
      return result;
    }
  }

  return [];
}

// ── getProviderInfo ───────────────────────────────────────────────────────────

export function getProviderInfo(): { mode: ProviderMode; model: string; available: boolean } {
  const mode = (process.env['AI_PROVIDER'] as ProviderMode | undefined) ?? 'none';
  const available =
    mode === 'cloud' ? !!process.env['ANTHROPIC_API_KEY'] :
    mode === 'local' ? !!process.env['LOCAL_LLM_URL']     :
    mode === 'free'  ? !!process.env['FREE_LLM_URL']      :
    mode === 'auto'  ? true /* tries multiple */           :
    false;

  const model =
    mode === 'cloud' ? (process.env['ANTHROPIC_PARSE_MODEL'] ?? 'claude-haiku-4-5-20251001') :
    mode === 'local' ? 'local'  :
    mode === 'free'  ? 'free'   :
    'deterministic';

  return { mode, model, available };
}
