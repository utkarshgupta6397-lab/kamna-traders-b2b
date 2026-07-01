import { getZohoTokens, getZohoOrgId } from './src/lib/zoho-auth';

const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

async function fetchEntity(entity: string, orgId: string, accessToken: string, contactId: string) {
  const url = `${API_BASE_URL}/books/v3/${entity}?organization_id=${orgId}&customer_id=${contactId}`;
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } });
  const data = await res.json();
  return data[entity] || [];
}

async function main() {
  const contactIds = ['1759923000016495139', '1759923000021105908'];
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();

  if (!orgId || !accessToken) {
    console.error('Missing orgId or accessToken');
    return;
  }

  for (const id of contactIds) {
    console.log(`\n--- Transactions for Contact ID: ${id} ---`);
    const invoices = await fetchEntity('invoices', orgId, accessToken, id);
    const payments = await fetchEntity('customerpayments', orgId, accessToken, id);
    const creditnotes = await fetchEntity('creditnotes', orgId, accessToken, id);
    const salesorders = await fetchEntity('salesorders', orgId, accessToken, id);
    
    console.log(`Invoices: ${invoices.length}`);
    console.log(`Payments: ${payments.length}`);
    console.log(`Credit Notes: ${creditnotes.length}`);
    console.log(`Sales Orders: ${salesorders.length}`);
  }
}

main().catch(console.error);
