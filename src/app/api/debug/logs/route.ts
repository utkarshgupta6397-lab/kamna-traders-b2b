import { NextResponse } from 'next/server';
import { DevLogger } from '@/lib/utils/DevLogger';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const runs = DevLogger.getRuns();
  
  // Create a synthetic trace for the fetch itself so we know it's hitting the API route
  try {
    DevLogger.log({
      module: 'Diagnostics',
      runId: 'system',
      event: '[DEV-CONSOLE] LOG_FETCH',
      status: 'INFO',
      input: { count: runs.length, timestamp: new Date().toISOString() }
    });
  } catch (e) {
    console.error('[DEV-LOGGER-FAILURE]', e);
  }

  return NextResponse.json({ runs });
}

export async function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  DevLogger.clearLogs();
  return NextResponse.json({ success: true });
}
