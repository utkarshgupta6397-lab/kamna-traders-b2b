import { PrismaClient } from '@prisma/client';
import { getZohoTokens } from './src/lib/zoho-auth';

const prisma = new PrismaClient();
const customerId = '1759923000001481508';

async function run() {
  const token = await getZohoTokens();
  if (!token) { console.log('no token'); return; }
  
  const orgId = process.env.ZOHO_BOOKS_ORG_ID || process.env.ZOHO_ORGANIZATION_ID || '60027595766';
  const url = `https://www.zohoapis.in/books/v3/contacts/${customerId}?organization_id=${orgId}`;
  
  console.log('Fetching:', url);
  const response = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` }
  });
  
  const data = await response.json();
  console.log('RAW ZOHO DATA:\n' + JSON.stringify(data, null, 2));
}

run().finally(() => prisma.$disconnect());
