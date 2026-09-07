const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\/\/ Audio object initialization[\s\S]*?\}, \[\]\);\n/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed audio effect.');
