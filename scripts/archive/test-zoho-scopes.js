async function run() {
  const scopes = [
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
    'ZohoBooks.settings.READ',
    'ZohoBooks.accountants.READ'
  ];

  const client_id = '1000.XXXXX'; // dummy
  const url = `https://accounts.zoho.in/oauth/v2/auth?scope=${scopes.join(',')}&client_id=${client_id}&response_type=code&redirect_uri=http://localhost&access_type=offline`;
  
  const res = await fetch(url, { redirect: 'manual' });
  const text = await res.text();
  console.log('Status:', res.status);
  if (res.status === 302 || res.status === 303) {
    console.log('Location:', res.headers.get('location'));
  } else {
    const match = text.match(/invalid_scope/i);
    console.log('Found invalid_scope?', match ? 'Yes' : 'No');
  }
}
run();
