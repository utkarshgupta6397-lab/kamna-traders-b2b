const http = require('http');
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3002${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}
async function run() {
  const doc = await makeRequest('/api/solar-orders/documentation-dashboard?limit=20');
  console.log('Doc items with limit 20:', doc.items ? doc.items.length : 'N/A');
}
run();
