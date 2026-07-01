const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/ZOHO_CLIENT_ID=([^\n]+)/);
const clientId = match ? match[1].trim() : '';

async function checkScope(scope) {
  const url = `https://accounts.zoho.in/oauth/v2/auth?scope=${scope}&client_id=${clientId}&response_type=code&redirect_uri=http://localhost:3002/api/zoho/callback&access_type=offline`;
  const res = await fetch(url, { redirect: 'manual' });
  const text = await res.text();
  console.log(`[${scope}] Status: ${res.status}`);
  // grep for error
  const errMatch = text.match(/error=([^&"']+)/);
  if (errMatch) {
     console.log(`Error: ${errMatch[1]}`);
  }
}
checkScope('ZohoBooks.bankaccounts.READ');
checkScope('ZohoBooks.banking.READ');
checkScope('ZohoBooks.settings.READ');
checkScope('ZohoBooks.estimates.READ');
