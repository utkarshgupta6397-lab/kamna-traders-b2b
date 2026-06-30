import { prisma } from '../lib/db';
import { getZohoTokens, getZohoOrgId } from '../lib/zoho-auth';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function verifyZohoFinancials() {
  console.log('\n--- ZOHO FINANCIALS DIAGNOSTIC ---');
  try {
    const order = await prisma.solarOrder.findFirst({
      where: { zohoBooksCustomerId: { not: null } }
    });

    if (!order || !order.zohoBooksCustomerId) {
      console.log('No order with mapped customer found. Run this on a DB with a mapped order.');
      return;
    }

    const customerId = order.zohoBooksCustomerId;
    console.log(`Testing with Local Order ID: ${order.id}`);
    console.log(`Mapped Zoho Contact ID: ${customerId}`);

    const accessToken = await getZohoTokens();
    const orgId = getZohoOrgId();

    if (!accessToken || !orgId) {
      console.log('No Zoho tokens/orgId configured. Is the app connected to Zoho?');
      return;
    }

    const API_BASE_URL = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';

    const endpoints = [
      { name: 'Contacts', key: 'contact', url: `${API_BASE_URL}/books/v3/contacts/${customerId}?organization_id=${orgId}` },
      { name: 'Estimates', key: 'estimates', url: `${API_BASE_URL}/books/v3/estimates?organization_id=${orgId}&customer_id=${customerId}&sort_column=date&sort_order=D` },
      { name: 'Sales Orders', key: 'salesorders', url: `${API_BASE_URL}/books/v3/salesorders?organization_id=${orgId}&customer_id=${customerId}&sort_column=date&sort_order=D` },
      { name: 'Invoices', key: 'invoices', url: `${API_BASE_URL}/books/v3/invoices?organization_id=${orgId}&customer_id=${customerId}&sort_column=date&sort_order=D` },
      { name: 'Payments', key: 'customerpayments', url: `${API_BASE_URL}/books/v3/customerpayments?organization_id=${orgId}&customer_id=${customerId}&sort_column=date&sort_order=D` }
    ];

    console.log('\nRESULTS:');

    for (const ep of endpoints) {
      const start = Date.now();
      const res = await fetch(ep.url, {
        headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
      });
      const duration = Date.now() - start;
      const json = await res.json();
      
      const isSuccess = res.ok;
      const icon = isSuccess ? '✓' : '✗';
      const statusCode = res.status;
      const zohoCode = json.code;
      const zohoMsg = json.message || 'No message';
      
      const recordCount = Array.isArray(json[ep.key]) ? json[ep.key].length : (json[ep.key] ? 1 : 0);

      console.log(`${icon} ${ep.name}`);
      console.log(`   URL: ${ep.url}`);
      console.log(`   HTTP Status: ${statusCode} | Zoho Code: ${zohoCode}`);
      console.log(`   Duration: ${duration} ms | Records: ${recordCount}`);
      if (!isSuccess) {
        console.log(`   Error: ${zohoMsg}`);
      }
      console.log('');
    }

    const tokenRecord = await prisma.zohoToken.findUnique({ where: { id: 'singleton' } });
    console.log(`Current OAuth Scope Version: ${tokenRecord?.scopeVersion}`);
    console.log(`Granted Scopes: ${tokenRecord?.grantedScopes}`);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

verifyZohoFinancials();
