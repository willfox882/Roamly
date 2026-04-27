import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────────

export const EventTypeEnum = z.enum([
  'flight',
  'hotel',
  'excursion',
  'transport',
  'reservation',
  'other',
]);

export const EventStatusEnum = z.enum([
  'confirmed',
  'tentative',
  'needs_review',
  'cancelled',
]);

export const OriginEnum = z.enum(['local', 'remote', 'import']);

export const GapSeverityEnum = z.enum(['low', 'medium', 'high']);

export const GapTypeEnum = z.enum([
  'missing_accommodation',
  'missing_transport',
  'missing_confirmation',
  'overlap',
  'timezone_drift',
]);

// ── Core entities ─────────────────────────────────────────────────────────────

export const TripSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  startDate: z.string(), // ISO date YYYY-MM-DD
  endDate: z.string(),
  timezone: z.string(),
  notes: z.string().optional(),
  dataVersion: z.number().int().default(1),
  createdAt: z.string(),
  lastModifiedAt: z.string(),
  origin: OriginEnum,
});

export const EventSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  userId: z.string().uuid(),
  type: EventTypeEnum,
  startDatetime: z.string().nullable(),
  endDatetime: z.string().nullable(),
  timezone: z.string().nullable(),
  locationName: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  provider: z.string().nullable(),
  confirmationNumber: z.string().nullable(),
  pnr: z.string().nullable(),
  ignoreConfirmation: z.boolean().optional(),
  rawSourceJson: z.unknown(),
  parsedJson: z.unknown(),
  confidence: z.number().min(0).max(1),
  status: EventStatusEnum,
  createdAt: z.string(),
  lastModifiedAt: z.string(),
  origin: OriginEnum,
});

export const BucketPinSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  country: z.string().optional(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  completed: z.boolean(),
  completedDate: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  lastModifiedAt: z.string(),
  origin: OriginEnum,
});

export const ExclusionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  placeName: z.string().min(1),
  lat: z.number().optional(),
  lng: z.number().optional(),
  country: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string(),
  lastModifiedAt: z.string(),
  origin: OriginEnum,
});

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  blobKey: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
  createdAt: z.string(),
});

export const ChangelogEntrySchema = z.object({
  id: z.string().uuid(),
  recordType: z.string(),
  recordId: z.string().uuid(),
  op: z.enum(['create', 'update', 'delete']),
  ts: z.string(),
  origin: OriginEnum,
});

export const BackupMetaSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string(),
  encrypted: z.boolean(),
  destination: z.enum(['download', 'supabase', 's3', 'gdrive', 'local']),
  remoteRef: z.string().optional(),
});

// ── Backup bundle ─────────────────────────────────────────────────────────────

export const BackupBundleSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  app: z.literal('NomadVault'),
  records: z.object({
    trips: z.array(TripSchema),
    events: z.array(EventSchema),
    bucketPins: z.array(BucketPinSchema),
    exclusions: z.array(ExclusionSchema),
    attachments: z.array(AttachmentSchema).optional().default([]),
    changelog: z.array(ChangelogEntrySchema).optional().default([]),
    backupsMeta: z.array(BackupMetaSchema).optional().default([]),
  }),
});

export const EncryptedEnvelopeSchema = z.object({
  alg: z.literal('AES-GCM'),
  kdf: z.literal('PBKDF2-SHA256'),
  iterations: z.number().int().positive(),
  salt: z.string(), // base64
  iv: z.string(), // base64
  ciphertext: z.string(), // base64
  sha256: z.string(), // hex of plaintext
});

// ── AI / Parser ───────────────────────────────────────────────────────────────

export const ParsedEventSchema = z.object({
  type: EventTypeEnum,
  startDatetime: z.string().nullable(),
  endDatetime: z.string().nullable(),
  timezone: z.string().nullable(),
  locationName: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  provider: z.string().nullable(),
  confirmationNumber: z.string().nullable(),
  pnr: z.string().nullable(),
  ignoreConfirmation: z.boolean().optional(),
  rawSourceJson: z.unknown(),
  parsedJson: z.unknown(),
  confidence: z.number().min(0).max(1),
  status: EventStatusEnum,
});

export const RecommendationSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  description: z.string(),
  reasoning: z.string(),
  website: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

// ── User prefs ────────────────────────────────────────────────────────────────

export const UserPrefsSchema = z.object({
  userId: z.string().uuid(),
  homeBase: z.string().optional(), // IATA or city name
  theme: z.enum(['system', 'light', 'dark']).default('dark'),
  aiProvider: z.enum(['cloud', 'free', 'local', 'none', 'auto']).default('none'),
  aiConsent: z.boolean().default(false),
  syncEnabled: z.boolean().default(false),
  backupCadence: z.enum(['off', 'daily', 'weekly', 'monthly']).default('off'),
  backupDestination: z
    .enum(['download', 'supabase', 's3', 'gdrive'])
    .default('download'),
  excludedPlaceIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  lastModifiedAt: z.string(),
});

// ── Gap detection ─────────────────────────────────────────────────────────────

export const GapSchema = z.object({
  id: z.string(),
  type: GapTypeEnum,
  severity: GapSeverityEnum,
  message: z.string(),
  relatedEventIds: z.array(z.string().uuid()),
  suggestedActions: z.array(
    z.object({
      label: z.string(),
      actionId: z.string(),
    }),
  ),
});

// ── Sync protocol ─────────────────────────────────────────────────────────────

export const ConflictDescriptorSchema = z.object({
  recordType: z.string(),
  id: z.string().uuid(),
  localVersion: z.record(z.unknown()),
  remoteVersion: z.record(z.unknown()),
  fields: z.array(z.string()),
});

export const PushBodySchema = z.object({
  since: z.string(),
  changes: z.array(ChangelogEntrySchema),
  records: z.record(z.string(), z.record(z.string(), z.unknown())),
});

export const PullResultSchema = z.object({
  records: z.record(z.string(), z.array(z.unknown())),
  deletedIds: z.record(z.string(), z.array(z.string())),
  serverTs: z.string(),
});

// ── Import report ─────────────────────────────────────────────────────────────

export const ImportReportSchema = z.object({
  added: z.number().int().nonnegative(),
  replaced: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  conflicts: z.array(ConflictDescriptorSchema),
  snapshotId: z.string().uuid().optional(),
  dryRun: z.boolean(),
});

// ── Inferred TS types ─────────────────────────────────────────────────────────

export type Trip = z.infer<typeof TripSchema>;
export type Event = z.infer<typeof EventSchema>;
export type BucketPin = z.infer<typeof BucketPinSchema>;
export type Exclusion = z.infer<typeof ExclusionSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;
export type BackupMeta = z.infer<typeof BackupMetaSchema>;
export type BackupBundle = z.infer<typeof BackupBundleSchema>;
export type EncryptedEnvelope = z.infer<typeof EncryptedEnvelopeSchema>;
export type ParsedEvent = z.infer<typeof ParsedEventSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type UserPrefs = z.infer<typeof UserPrefsSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type ConflictDescriptor = z.infer<typeof ConflictDescriptorSchema>;
export type PushBody = z.infer<typeof PushBodySchema>;
export type PullResult = z.infer<typeof PullResultSchema>;
export type ImportReport = z.infer<typeof ImportReportSchema>;

export type EventType = z.infer<typeof EventTypeEnum>;
export type EventStatus = z.infer<typeof EventStatusEnum>;
export type Origin = z.infer<typeof OriginEnum>;
export type GapSeverity = z.infer<typeof GapSeverityEnum>;
export type GapType = z.infer<typeof GapTypeEnum>;
