const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  '  receivedAt: string;\n}',
  '  receivedAt: string;\n  detailsStatus?: string;\n  detailsFetchError?: string | null;\n}'
);

content = content.replace(/\(order as any\)\.detailsStatus/g, 'order.detailsStatus');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Interface updated.');
