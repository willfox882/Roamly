import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const BACKUPS_DIR = path.join(process.cwd(), 'tmp', 'backups');

const RestoreBodySchema = z.object({
  backupId: z.string(),
  mode: z.enum(['full', 'partial', 'dry_run']),
  selection: z
    .object({ tripIds: z.array(z.string()).optional() })
    .optional(),
});

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

  const parsed = RestoreBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'BAD_REQUEST', message: parsed.error.message } },
      { status: 400 },
    );
  }

  const { backupId } = parsed.data;
  const binPath = path.join(BACKUPS_DIR, `${backupId}.bin`);
  const metaPath = path.join(BACKUPS_DIR, `${backupId}.meta.json`);

  if (!fs.existsSync(binPath) || !fs.existsSync(metaPath)) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Backup not found' } },
      { status: 404 },
    );
  }

  const ciphertext = Buffer.from(fs.readFileSync(binPath)).toString('base64');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as unknown;

  // Server returns the encrypted bundle; client decrypts + applies locally
  return NextResponse.json({ data: { ciphertext, meta }, error: null });
}
