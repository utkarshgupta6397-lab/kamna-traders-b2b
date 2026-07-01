import * as fs from 'fs';

const parseSerials = (text: string, mode: 'line' | 'comma' | 'dcr_cert') => {
  if (mode === 'line') {
    return text.split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  if (mode === 'comma') {
    return text.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  // DCR Certificate Text Mode (Regex-based intelligent extraction)
  const matches = text.match(/[A-Z0-9-]+/gi) || [];
  const serials: string[] = [];
  const excludeKeywords = new Set([
    'SERIAL', 'PANEL', 'RATING', 'MODULE', 'WATTAGE', 'VENDOR', 'INVOICE', 'NUMBER', 'STATUS', 'DCR', 'RECEIVED',
    'DETAILS', 'ELIGIBLE', 'PENDING', 'PROCESSED', 'PRODUCT', 'REPORT', 'ACTION', 'FAILURE', 'REASON'
  ]);
  
  for (const m of matches) {
    const cleaned = m.trim().toUpperCase();
    if (cleaned.length < 6 || cleaned.length > 30) continue;
    
    // Pure numbers are valid serials (e.g., 5015852452).
    // Wattages like "620" are ignored because their length is < 6.
    
    // Ignore wattage/ratings like 620WP, 620W, 545W
    if (/^\d+W[P]?$/i.test(cleaned)) continue;
    
    // Ignore common keywords
    if (excludeKeywords.has(cleaned)) continue;
    
    serials.push(cleaned);
  }
  
  return serials;
};

const runTest = () => {
  const cases = [
    { name: 'Case 1', input: '5015852452 (550 Wp)', expected: 1, mode: 'dcr_cert' },
    { name: 'Case 2', input: '5015852452 (550 Wp) 5015852458 (550 Wp)', expected: 2, mode: 'dcr_cert' },
    { name: 'Case 3', input: '5015852452,5015852458', expected: 2, mode: 'comma' },
    { name: 'Case 4', input: 'AS2605241B1547', expected: 1, mode: 'dcr_cert' },
    { name: 'Case 5', input: '5015852452 (550 Wp)\nAS2605241B1547', expected: 2, mode: 'dcr_cert' },
  ];

  cases.forEach(c => {
    const res = parseSerials(c.input, c.mode as any);
    console.log(`${c.name} [${c.mode}]: expected ${c.expected}, got ${res.length}`);
    if (res.length > 0) {
      console.log('  ->', res);
    }
  });
};

runTest();
