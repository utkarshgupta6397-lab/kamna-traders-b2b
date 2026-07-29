const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  console.log('Navigating to login page...');
  await page.goto('http://localhost:3002/staff', { waitUntil: 'networkidle0' });
  
  console.log('Recording 10s trace...');
  await page.tracing.start({ path: 'trace.json', screenshots: false, categories: ['devtools.timeline', 'v8.execute', 'blink.user_timing'] });
  
  await new Promise(r => setTimeout(r, 10000));
  
  await page.tracing.stop();
  console.log('Trace saved to trace.json');
  
  // Quick manual parsing of trace for metrics
  const trace = JSON.parse(fs.readFileSync('trace.json', 'utf8'));
  let totalTime = 0;
  let layoutTime = 0;
  let scriptTime = 0;
  let paintTime = 0;
  
  const functionCounts = {};
  
  trace.traceEvents.forEach(e => {
    if (e.dur) {
      totalTime += e.dur;
      if (e.name === 'Layout') layoutTime += e.dur;
      if (e.name === 'Paint' || e.name === 'CompositeLayers') paintTime += e.dur;
      if (e.name === 'EvaluateScript' || e.name === 'FunctionCall') {
        scriptTime += e.dur;
        if (e.args?.data?.functionName) {
          const fn = e.args.data.functionName;
          functionCounts[fn] = (functionCounts[fn] || 0) + e.dur;
        }
      }
    }
  });
  
  console.log('--- Trace Analysis ---');
  console.log(`Scripting: ${scriptTime / 1000} ms`);
  console.log(`Layout: ${layoutTime / 1000} ms`);
  console.log(`Paint/Composite: ${paintTime / 1000} ms`);
  
  const sortedFns = Object.entries(functionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Top JS Functions:');
  sortedFns.forEach(([fn, dur]) => {
    console.log(`- ${fn}: ${dur / 1000} ms`);
  });
  
  await browser.close();
})();
