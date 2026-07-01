import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  const vendorId = '1759923000018641237';
  
  // Let's try vendorpayments again, maybe without vendor_id just to see
  const urlsToTry = [
    `${API_BASE_URL}/books/v3/vendorpayments?organization_id=${orgId}&vendor_id=${vendorId}`,
    `${API_BASE_URL}/books/v3/paymentsmade?organization_id=${orgId}&vendor_id=${vendorId}`,
    `${API_BASE_URL}/books/v3/purchases/payments?organization_id=${orgId}&vendor_id=${vendorId}`
  ];
  
  for (const url of urlsToTry) {
    console.log('Trying:', url);
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    const data = await res.json();
    console.log('Result keys:', Object.keys(data));
    if (data.code === 0) {
      console.log('SUCCESS for', url);
      console.log('Data keys:', Object.keys(data));
      // Log the first item
      const listKey = Object.keys(data).find(k => k !== 'code' && k !== 'message' && k !== 'page_context');
      if (listKey && data[listKey].length > 0) {
        console.log('First item:', data[listKey][0]);
      }
    } else {
      console.log('Error:', data.message);
    }
    console.log('---');
  }
}
main().catch(console.error);
