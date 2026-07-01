const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/ZOHO_CLIENT_ID=([^\n]+)/);
const clientId = match ? match[1].trim() : '';

const scopesList = [
    'ZohoBooks.contacts.READ',
    'ZohoBooks.contacts.CREATE',
    'ZohoBooks.items.READ',
    'ZohoBooks.estimates.READ',
    'ZohoBooks.estimates.CREATE',
    'ZohoBooks.salesorders.READ',
    'ZohoBooks.salesorders.CREATE',
    'ZohoBooks.invoices.READ',
    'ZohoBooks.invoices.CREATE',
    'ZohoBooks.customerpayments.READ',
    'ZohoBooks.bills.READ',
    'ZohoBooks.vendorpayments.READ',
    'ZohoBooks.bankaccounts.READ',
    'ZohoBooks.banking.READ',
    'ZohoBooks.settings.READ',
    'ZohoBooks.accountants.READ'
];

async function checkScope(scope) {
  const url = `https://accounts.zoho.in/oauth/v2/auth?scope=${scope}&client_id=${clientId}&response_type=code&redirect_uri=http://localhost:3002/api/zoho/callback&access_type=offline`;
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status === 302 || res.status === 303) {
    const loc = res.headers.get('location') || '';
    if (loc.includes('invalid_scope') || loc.includes('error=invalid_scope')) {
       console.log(`[INVALID] ${scope}`);
    } else {
       console.log(`[VALID?] ${scope}`);
    }
  } else {
    const text = await res.text();
    if (text.includes('invalid_scope')) {
       console.log(`[INVALID] ${scope} (in body)`);
    } else {
       console.log(`[UNKNOWN] ${scope} - HTTP ${res.status}`);
    }
  }
}

async function run() {
  for (const s of scopesList) {
    await checkScope(s);
  }
}
run();
