import { getAuthorizationUrl } from '@/lib/zoho-auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = getAuthorizationUrl();
  
  // Extract scope query param to display clearly
  const urlObj = new URL(url);
  const scopeParam = urlObj.searchParams.get('scope') || '';
  
  console.log('FINAL_SCOPE_STRING=' + scopeParam);
  console.log('FINAL_AUTH_URL=' + url);
  
  return NextResponse.redirect(url);
}
