import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Only allow in development mode or if explicitly enabled
  if (process.env.NODE_ENV !== 'development' && process.env.NEXT_PUBLIC_ENABLE_API_TELEMETRY !== 'true') {
    return NextResponse.json({ error: 'Telemetry disabled' }, { status: 403 });
  }

  const zohoCalls = (globalThis as any).__ZOHO_TELEMETRY__ || [];
  
  // Clear the array after reading so we don't send duplicate logs on the next poll
  (globalThis as any).__ZOHO_TELEMETRY__ = [];

  return NextResponse.json({
    success: true,
    calls: zohoCalls
  });
}
