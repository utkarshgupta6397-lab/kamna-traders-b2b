import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function main() {
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  
  const fullContactUrl = `${API_BASE_URL}/books/v3/contacts/1759923000021105908?organization_id=${orgId}`;
  const fRes = await fetch(fullContactUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const fData = await fRes.json();
  
  console.log('contact_type:', fData.contact?.contact_type);
  console.log('associated_vendor_details:', fData.contact?.associated_vendor_details);
  
  // Now let's fetch Vendor Payments for the Vendor ID
  const vendorId = fData.contact?.associated_vendor_details?.vendor_id || '1759923000018641237';
  console.log('Fetching vendorpayments for vendor:', vendorId);
  const vpUrl = `${API_BASE_URL}/books/v3/vendorpayments?organization_id=${orgId}&vendor_id=${vendorId}`;
  const vpRes = await fetch(vpUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const vpData = await vpRes.json();
  
  console.log('Vendor Payments:', vpData.vendorpayments?.map(vp => ({
    id: vp.payment_id,
    date: vp.date,
    amount: vp.amount,
    payment_mode: vp.payment_mode
  })));
  
  // Let's fetch the first Vendor Payment details
  if (vpData.vendorpayments && vpData.vendorpayments.length > 0) {
    const pmtId = vpData.vendorpayments[0].payment_id;
    const pmtUrl = `${API_BASE_URL}/books/v3/vendorpayments/${pmtId}?organization_id=${orgId}`;
    const pmtRes = await fetch(pmtUrl, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
    const pmtData = await pmtRes.json();
    console.log('First Payment Details:', pmtData.vendorpayment?.bills);
  }
}
main().catch(console.error);
