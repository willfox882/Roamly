import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { BackupMetaSchema } from '@/lib/schema';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const UploadBodySchema = z.object({
  meta: BackupMetaSchema,
  ciphertext: z.string(), // base64-encoded encrypted payload
});

const BACKUPS_DIR = path.join(process.cwd(), 'tmp', 'backups');

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
      { status: 400 },
    );
  }

  const parsed = UploadBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { meta, ciphertext } = parsed.data;
  const bytes = Buffer.from(ciphertext, 'base64');
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');

  if (actualHash !== meta.sha256) {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: 'SHA-256 mismatch — payload corrupted' } },
      { status: 400 },
    );
  }

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  fs.writeFileSync(path.join(BACKUPS_DIR, `${meta.id}.bin`), bytes);
  fs.writeFileSync(path.join(BACKUPS_DIR, `${meta.id}.meta.json`), JSON.stringify(meta), 'utf8');

  return NextResponse.json({ data: { id: meta.id }, error: null });
}
