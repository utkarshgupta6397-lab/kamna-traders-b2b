import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { sessionToken } = await request.json();
    if (!sessionToken) {
      return NextResponse.json({ isValid: false }, { status: 400 });
    }

    const result = await validateSession(sessionToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Session-API] Validation failed:', error);
    return NextResponse.json({ isValid: false }, { status: 500 });
  }
}
