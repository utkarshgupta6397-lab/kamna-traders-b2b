const fs = require('fs');
let file = fs.readFileSync('src/app/api/solar-orders/documentation-dashboard/route.ts', 'utf8');

file = file.replace(/console\.log\("/g, 'require("fs").appendFileSync("/tmp/next_logs.txt", "');

fs.writeFileSync('src/app/api/solar-orders/documentation-dashboard/route.ts', file);
