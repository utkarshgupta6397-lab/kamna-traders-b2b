import { NextResponse } from 'next/server';
import { DevLogger } from '@/lib/utils/DevLogger';

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const body = await req.json();
    DevLogger.log({
      module: body.module || 'Diagnostics',
      runId: body.runId || 'ui-trace',
      event: body.event || 'Unknown',
      status: body.status || 'INFO',
      input: body.input,
      output: body.output,
      error: body.error
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
