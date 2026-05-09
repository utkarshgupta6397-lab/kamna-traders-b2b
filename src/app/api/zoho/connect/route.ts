import { getAuthorizationUrl } from '@/lib/zoho-auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = getAuthorizationUrl();
  return NextResponse.redirect(url);
}
