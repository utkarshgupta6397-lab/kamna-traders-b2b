import { NextResponse } from 'next/server';
import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const orgId = getZohoOrgId();
  const token = await getZohoTokens();
  
  const response = await fetch(`https://www.zohoapis.in/books/v3/settings/preferences/customfields?entity=salesorder&organization_id=${orgId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  
  const data = await response.json();
  return NextResponse.json(data);
}
