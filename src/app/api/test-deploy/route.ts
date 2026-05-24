import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Deployment pipeline working',
    timestamp: new Date().toISOString(),
  });
}
