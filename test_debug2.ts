import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

async function testEndpoint(endpoint: string) {
  const token = await getZohoTokens();
  const orgId = getZohoOrgId();
  const accountId = '1759923000003416718';
  
  console.log(`\nTesting endpoint: ${endpoint}`);
  const url = `https://www.zohoapis.in${endpoint}?organization_id=${orgId}&account_id=${accountId}`;
  const res = await fetch(url, { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } });
  
  if (!res.ok) {
     console.log('Failed:', await res.text());
     return;
  }
  
  const data = await res.json();
  const keys = Object.keys(data);
  console.log('Success! Keys:', keys);
  
  // Find which key holds the array
  const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
  if (arrKey) {
     const arr = data[arrKey];
     console.log(`Array key: ${arrKey}, length: ${arr.length}`);
     const target = arr.filter((t: any) => JSON.stringify(t).includes('SHREE SIDHBALI'));
     console.log(`Target found: ${target.length}`);
  }
}

async function run() {
   await testEndpoint('/books/v3/bankstatements');
   await testEndpoint('/books/v3/statements');
   await testEndpoint(`/books/v3/bankaccounts/1759923000003416718/statements`);
}

run().catch(console.error).finally(() => process.exit(0));
