import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

async function testEndpoint() {
  const token = await getZohoTokens();
  const orgId = getZohoOrgId();
  const date = new Date().toISOString().split('T')[0];
  
  const url = `https://www.zohoapis.in/books/v3/customerpayments?organization_id=${orgId}&date=${date}`;
  const res = await fetch(url, { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } });
  
  const data = await res.json();
  const payments = data.customerpayments || [];
  
  console.log(`Found ${payments.length} customer payments for ${date}`);
  if (payments.length > 0) {
    console.log(JSON.stringify(payments[0], null, 2));
  }
}

testEndpoint().catch(console.error).finally(() => process.exit(0));
