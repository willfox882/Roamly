import { z } from 'zod';
import {
  TripSchema,
  EventSchema,
  ParsedEventSchema,
  RecommendationSchema,
  BackupMetaSchema,
  PushBodySchema,
  PullResultSchema,
  type Trip,
  type Event,
  type ParsedEvent,
  type Recommendation,
  type BackupMeta,
  type PushBody,
  type PullResult,
} from '@/lib/schema';

// ── AppError ──────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  method: string,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  if (!navigator.onLine && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
    throw new AppError('OFFLINE', 'Cannot send write requests while offline');
  }

  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const json = (await res.json()) as { data: unknown; error: unknown };

  if (!res.ok || json.error) {
    const err = json.error as { code?: string; message?: string; details?: unknown } | null;
    throw new AppError(
      err?.code ?? 'UNKNOWN',
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }

  return schema.parse(json.data);
}

// ── apiClient ─────────────────────────────────────────────────────────────────

export const apiClient = {
  trips: {
    list: () =>
      apiFetch('GET', '/api/trips', z.array(TripSchema)),

    create: (trip: Omit<Trip, 'id'>) =>
      apiFetch('POST', '/api/trips', TripSchema, trip),

    get: (id: string) =>
      apiFetch('GET', `/api/trips/${id}`, TripSchema),

    update: (id: string, patch: Partial<Trip>) =>
      apiFetch('PUT', `/api/trips/${id}`, TripSchema, patch),

    delete: (id: string) =>
      apiFetch('DELETE', `/api/trips/${id}`, z.object({ deleted: z.literal(true) })),
  },

  events: {
    list: (params?: { tripId?: string }) => {
      const qs = params?.tripId ? `?trip_id=${params.tripId}` : '';
      return apiFetch('GET', `/api/events${qs}`, z.array(EventSchema));
    },

    create: (event: Omit<Event, 'id'>) =>
      apiFetch('POST', '/api/events', EventSchema, event),

    update: (id: string, patch: Partial<Event>) =>
      apiFetch('PUT', `/api/events/${id}`, EventSchema, patch),

    delete: (id: string) =>
      apiFetch('DELETE', `/api/events/${id}`, z.object({ deleted: z.literal(true) })),

    parse: (rawText: string, provider?: string) =>
      apiFetch(
        'POST',
        '/api/events/parse',
        z.array(ParsedEventSchema),
        { raw_text: rawText, provider },
      ),
  },

  ai: {
    parse: (rawText: string) =>
      apiFetch('POST', '/api/ai/parse', z.array(ParsedEventSchema), { raw_text: rawText }),

    recommend: (input: {
      lat: number; lng: number;
      startDate: string; endDate: string;
      exclusions: string[];
      preferences: Record<string, unknown>;
    }) =>
      apiFetch('POST', '/api/ai/recommend', z.array(RecommendationSchema), input),
  },

  sync: {
    push: (body: PushBody) =>
      apiFetch(
        'POST',
        '/api/sync/push',
        z.object({ accepted: z.array(z.string()), conflicts: z.array(z.unknown()) }),
        PushBodySchema.parse(body),
      ),

    pull: (since: string) =>
      apiFetch('GET', `/api/sync/pull?since=${encodeURIComponent(since)}`, PullResultSchema),
  },

  backups: {
    upload: (meta: BackupMeta, ciphertext: string) =>
      apiFetch('POST', '/api/backups/upload', z.object({ id: z.string() }), { meta, ciphertext }),

    list: (): Promise<BackupMeta[]> =>
      apiFetch('GET', '/api/backups/list', z.array(BackupMetaSchema)),

    download: (id: string): Promise<string> =>
      apiFetch('GET', `/api/backups/download/${id}`, z.string()),

    restore: (backupId: string, mode: 'full' | 'partial' | 'dry_run') =>
      apiFetch('POST', '/api/backups/restore', z.unknown(), { backupId, mode }),
  },
} as const;

export type ApiClient = typeof apiClient;
// Export convenience types
export type { Trip, Event, ParsedEvent, Recommendation, BackupMeta, PushBody, PullResult };
