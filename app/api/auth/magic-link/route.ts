/**
 * STUB — POST /api/auth/magic-link.
 * Body: { email: string }. If Supabase configured, request magic link; else return { sent: true } stub.
 * TODO(sonnet): implement.
 */
import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ data: { sent: true }, error: null }); }
