import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';
import { prisma } from './src/lib/db';

async function test() {
  const token = await getZohoTokens();
  const orgId = getZohoOrgId();
  const accountId = '1759923000003416718';
  let allTransactions: any[] = [];
  let page = 1;
  let hasMorePage = true;
  
  console.log('Fetching Zoho Bank API directly...');
  while (hasMorePage && page <= 5) {
    const url = `https://www.zohoapis.in/books/v3/banktransactions?organization_id=${orgId}&account_id=${accountId}&page=${page}&per_page=200`;
    const res = await fetch(url, { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } });
    const data = await res.json();
    if (!res.ok) { console.error(data); break; }
    
    const txns = data.banktransactions || [];
    allTransactions = allTransactions.concat(txns);
    hasMorePage = data.page_context?.has_more_page;
    
    const target = txns.filter((t: any) => JSON.stringify(t).includes('SHREE SIDHBALI'));
    console.log(`Page ${page}: Found ${txns.length} txns. Target found: ${target.length}`);
    if (target.length > 0) {
      console.log('TARGET:', JSON.stringify(target, null, 2));
    }
    page++;
  }
}
test().catch(console.error).finally(() => process.exit(0));
