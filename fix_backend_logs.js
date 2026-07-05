const fs = require('fs');
let file = fs.readFileSync('src/app/api/solar-orders/documentation-dashboard/route.ts', 'utf8');

file = file.replace(/require\("fs"\)\.appendFileSync\("\/tmp\/next_logs\.txt", "/g, 'console.log("');

fs.writeFileSync('src/app/api/solar-orders/documentation-dashboard/route.ts', file);
