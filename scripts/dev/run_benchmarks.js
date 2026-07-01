const http = require('http');

async function benchmark(url) {
  const start = Date.now();
  return new Promise((resolve) => {
    // Note: The dev server might require valid auth cookies. 
    // Wait, the API routes check `getSession()`. If I don't have a session, I will get a 401 Unauthorized.
    // If it's a 401, the response time is artificially fast because it just rejects.
    // That means my automated benchmark script won't really test the queries unless I fake a session cookie or a Bearer token.
    http.get(`http://localhost:3002${url}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          time: Date.now() - start,
          sizeKB: Math.round(data.length / 1024),
          status: res.statusCode
        });
      });
    }).on('error', (err) => {
      console.error(err);
      resolve({ error: err.message });
    });
  });
}

async function run() {
  console.log('--- FINAL BENCHMARK ---');
  
  const endpoints = [
    '/api/solar-orders?limit=20&page=1',
    '/api/solar-orders/documentation-dashboard',
    '/api/solar-orders/installation-dashboard',
    '/api/solar-orders/reports',
    '/api/solar-orders/dashboard'
  ];

  for (const ep of endpoints) {
    const res = await benchmark(ep);
    console.log(`${ep}`);
    console.log(`Time: ${res.time}ms | Size: ${res.sizeKB}KB | Status: ${res.status}`);
    console.log('---------------------------');
  }
}

run();
