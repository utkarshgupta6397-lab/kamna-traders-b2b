import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  const vendorId = '1759923000018641237';
  
  const vpUrl = `${API_BASE_URL}/books/v3/vendorpayments?organization_id=${orgId}&vendor_id=${vendorId}`;
  const vpRes = await fetch(vpUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const vpData = await vpRes.json();
  
  console.log('API Response keys:', Object.keys(vpData));
  if (vpData.vendorpayments) {
    console.log('Vendor Payments Count:', vpData.vendorpayments.length);
    if (vpData.vendorpayments.length > 0) {
      console.log('First Payment:', vpData.vendorpayments[0]);
    }
  } else {
    console.log('Full response:', vpData);
  }
}
main().catch(console.error);
