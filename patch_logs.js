const fs = require('fs');
let file = fs.readFileSync('src/app/staff/dashboard/solar-orders/documentation-queue/DocumentationDashboardClient.tsx', 'utf8');

file = file.replace(
  'const data = await res.json();',
  'const data = await res.json();\n        console.log("STEP 1 - API Response length:", data.items ? data.items.length : 0);\n        window.__DEBUG_STEP_1 = data.items ? data.items.length : 0;'
);
file = file.replace(
  'setData(data);',
  'console.log("STEP 2 - Before setState:", data.items ? data.items.length : 0);\n        setData(data);'
);
file = file.replace(
  'return (',
  'console.log("STEP 3 - React State (data.items):", data?.items?.length);\n  window.__DEBUG_STEP_3 = data?.items?.length;\n  return ('
);

fs.writeFileSync('src/app/staff/dashboard/solar-orders/documentation-queue/DocumentationDashboardClient.tsx', file);
