const http = require('http');

async function checkRoute(route) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3002${route}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.items ? json.items.length : (json.queue ? json.queue.length : -1));
        } catch (e) {
          resolve(-1);
        }
      });
    }).on('error', () => resolve(-1));
  });
}

(async () => {
  const docLen = await checkRoute('/api/solar-orders/documentation-dashboard');
  const instLen = await checkRoute('/api/solar-orders/installation-dashboard');
  const calLen = await checkRoute('/api/solar-orders/calendar');
  console.log(`Documentation Queue count: ${docLen}`);
  console.log(`Installation Queue count: ${instLen}`);
  console.log(`Calendar Queue count: ${calLen}`);
})();
