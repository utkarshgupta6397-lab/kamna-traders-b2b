const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace:
// let eventSource: EventSource;
// with:
// let eventSource: EventSource;
// let reconnectTimeout: NodeJS.Timeout;
// let isUnmounted = false;

content = content.replace(
  'let eventSource: EventSource;',
  'let eventSource: EventSource;\n    let reconnectTimeout: NodeJS.Timeout;\n    let isUnmounted = false;'
);

// We should also fix the setTimeout assignment if it doesn't assign to reconnectTimeout
// Currently it is: setTimeout(connectSSE, 5000);
content = content.replace(
  'setTimeout(connectSSE, 5000);',
  'reconnectTimeout = setTimeout(connectSSE, 5000);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed TS error');
