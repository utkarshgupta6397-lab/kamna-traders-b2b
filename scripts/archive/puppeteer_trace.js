const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set auth cookie
  await page.setCookie({
    name: 'session',
    value: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbXIwOGJoOTcwMDBhdWF1OWlkOHJuazU2Iiwicm9sZSI6IlNUQUZGIiwic2Vzc2lvblRva2VuIjoiZTExMmYzMDgtMTBlYi00NWYyLTk0YTEtODNhZWU0OTY5Mjg3IiwiZGV2aWNlVHlwZSI6ImRlc2t0b3AiLCJleHBpcmVzIjoiMjAyNi0wNy0wMVQxNzo0MDowNC40MThaIiwiaWF0IjoxNzgyODQxMjA0LCJleHAiOjE3ODI5Mjc2MDR9.5gbYhb3917SozuPE4U0HHpgvitJAsYhV3-ThCEXGR6Y',
    domain: '0.0.0.0',
    path: '/'
  });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://0.0.0.0:3002/staff/dashboard/solar-orders/documentation-queue', { waitUntil: 'networkidle0' });
  
  await browser.close();
})();
