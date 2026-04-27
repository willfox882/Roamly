import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BACKUPS_DIR = path.join(process.cwd(), 'tmp', 'backups');

export async function GET() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    return NextResponse.json({ data: [], error: null });
  }

  const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.meta.json'));
  const metas = files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, f), 'utf8')) as unknown;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aDate = (a as { createdAt: string }).createdAt;
      const bDate = (b as { createdAt: string }).createdAt;
      return bDate.localeCompare(aDate);
    });

  return NextResponse.json({ data: metas, error: null });
}
