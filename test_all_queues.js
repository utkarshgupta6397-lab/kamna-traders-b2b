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
  const doc = await makeRequest('/api/solar-orders/documentation-dashboard');
  const inst = await makeRequest('/api/solar-orders/installation-dashboard');
  const cal = await makeRequest('/api/solar-orders/calendar');
  
  console.log('Doc items:', doc.items ? doc.items.length : 'N/A');
  console.log('Inst items:', inst.items ? inst.items.length : 'N/A');
  console.log('Cal queue:', cal.queue ? cal.queue.length : 'N/A');
}
run();
