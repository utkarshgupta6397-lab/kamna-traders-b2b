import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

async function testEndpoint() {
  const token = await getZohoTokens();
  const orgId = getZohoOrgId();
  const accountId = '1759923000003416718';
  
  const url = `https://www.zohoapis.in/books/v3/bankaccounts/${accountId}/statements?organization_id=${orgId}`;
  const res = await fetch(url, { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } });
  
  const data = await res.json();
  const statements = data.bankstatements || [];
  
  const target = statements.find((t: any) => JSON.stringify(t).includes('SHREE SIDHBALI'));
  console.log(JSON.stringify(target, null, 2));
}

testEndpoint().catch(console.error).finally(() => process.exit(0));
