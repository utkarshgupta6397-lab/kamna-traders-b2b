const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const updatedOrder = await response.json();',
  'const result = await response.json();\n      const updatedOrder = result.order;'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed fetch handler response parsing.');
