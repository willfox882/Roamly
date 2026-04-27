import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BACKUPS_DIR = path.join(process.cwd(), 'tmp', 'backups');

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const binPath = path.join(BACKUPS_DIR, `${id}.bin`);
  const metaPath = path.join(BACKUPS_DIR, `${id}.meta.json`);

  if (!fs.existsSync(binPath) || !fs.existsSync(metaPath)) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Backup not found' } },
      { status: 404 },
    );
  }

  const data = fs.readFileSync(binPath);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { sha256: string };

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="backup-${id}.nomadvault"`,
      'X-Backup-SHA256': meta.sha256,
    },
  });
}
