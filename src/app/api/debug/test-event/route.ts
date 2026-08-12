import { NextResponse } from 'next/server';
import { DevLogger } from '@/lib/utils/DevLogger';
import crypto from 'crypto';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const runId = crypto.randomUUID();
  DevLogger.log({
    module: 'Diagnostics',
    runId,
    event: '[DEV-CONSOLE-TEST] Test event',
    status: 'SUCCESS',
    input: { message: 'This is a test input payload' },
    output: { success: true, verified: true }
  });

  return NextResponse.json({ success: true, runId });
}
