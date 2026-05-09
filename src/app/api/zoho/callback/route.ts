import { exchangeAuthCode } from '@/lib/zoho-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/admin/zoho-debug?error=' + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/admin/zoho-debug?error=no_code', request.url));
  }

  const result = await exchangeAuthCode(code);

  if (result.success) {
    return NextResponse.redirect(new URL('/admin/zoho-debug?success=connected', request.url));
  } else {
    return NextResponse.redirect(new URL(`/admin/zoho-debug?error=${encodeURIComponent(result.error || 'exchange_failed')}`, request.url));
  }
}
