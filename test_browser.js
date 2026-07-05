const { chromium } = require('playwright');
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
  console.log("Checking API lengths first (with bypassed auth):");
  const docLen = await checkRoute('/api/solar-orders/documentation-dashboard');
  const calLen = await checkRoute('/api/solar-orders/calendar');
  console.log(`API Doc items: ${docLen}`);
  console.log(`API Cal queue: ${calLen}`);

  console.log("\nSimulating frontend render...");
  // We can't easily launch playwright without installing it, but let's check if it's available
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    // We would need to login first if auth is not bypassed
    // For now, let's just log what we found
    console.log("Playwright available, but skipping full login flow to save time.");
    await browser.close();
  } catch (e) {
    console.log("Playwright not available. Error:", e.message);
  }
})();
