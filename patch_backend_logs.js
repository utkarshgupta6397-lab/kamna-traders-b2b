const fs = require('fs');
let file = fs.readFileSync('src/app/api/solar-orders/documentation-dashboard/route.ts', 'utf8');

file = file.replace(
  'const ordersForKpis = await prisma.solarOrder.findMany',
  'console.log("BACKEND STEP 1 - where:", JSON.stringify(where));\n    const ordersForKpis = await prisma.solarOrder.findMany'
);

file = file.replace(
  'const now = new Date().getTime();',
  'console.log("BACKEND STEP 2 - ordersForKpis length:", ordersForKpis.length);\n    const now = new Date().getTime();'
);

file = file.replace(
  'const validItems = transformedItems.filter',
  'console.log("BACKEND STEP 3 - transformedItems length:", transformedItems.length);\n    const validItems = transformedItems.filter'
);

file = file.replace(
  'const totalCount = filteredItems.length;',
  'console.log("BACKEND STEP 4 - validItems length:", validItems.length);\n    const totalCount = filteredItems.length;\n    console.log("BACKEND STEP 5 - filteredItems length:", filteredItems.length);'
);

file = file.replace(
  'const paginatedIds = filteredItems.slice(skip, skip + limit).map',
  'const paginatedIds = filteredItems.slice(skip, skip + limit).map(item => item.id);\n    console.log("BACKEND STEP 6 - paginatedIds length:", paginatedIds.length);'
);

file = file.replace(
  'const fullItemsQuery = await prisma.solarOrder.findMany',
  'console.log("BACKEND STEP 7 - fetching full data for paginatedIds");\n    const fullItemsQuery = await prisma.solarOrder.findMany'
);

file = file.replace(
  'const fullItems = fullItemsQuery.map',
  'console.log("BACKEND STEP 8 - fullItemsQuery length:", fullItemsQuery.length);\n    const fullItems = fullItemsQuery.map'
);

fs.writeFileSync('src/app/api/solar-orders/documentation-dashboard/route.ts', file);
