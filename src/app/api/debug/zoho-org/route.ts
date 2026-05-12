import { getZohoTokens, getZohoOrgId } from '@/lib/zoho-auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
    const accessToken = await getZohoTokens();
    const orgId = getZohoOrgId();

    if (!accessToken) {
      return NextResponse.json({ 
        error: 'OAuth token missing or expired',
        token_record: tokenRecord ? { exists: true, expiresAt: tokenRecord.expiresAt } : { exists: false }
      }, { status: 401 });
    }

    // Fetch User Info
    const userRes = await fetch('https://accounts.zoho.in/oauth/user/info', {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });
    const userData = await userRes.json();

    // Fetch Organizations
    const orgRes = await fetch('https://www.zohoapis.in/books/v3/organizations', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const orgData = await orgRes.json();

    // Fetch Contact Info (Verify DEFAULT_CUSTOMER_ID)
    const customerId = process.env.DEFAULT_CUSTOMER_ID;
    let contactData = null;
    if (customerId) {
      const contactRes = await fetch(`https://www.zohoapis.in/books/v3/contacts/${customerId}?organization_id=${orgId}`, {
        headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
      });
      contactData = await contactRes.json();
    }

    return NextResponse.json({
      success: orgRes.ok,
      user: userData,
      configured_org_id: orgId,
      configured_customer_id: customerId,
      zoho_org_response: orgData,
      zoho_contact_response: contactData
    });

  } catch (error: any) {
    console.error('[DEBUG-ORG] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
