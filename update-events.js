const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lib/dispatch-events.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /NEW_INCOMING_ORDER: 'NEW_INCOMING_ORDER',/,
  "NEW_INCOMING_ORDER: 'NEW_INCOMING_ORDER',\n  UPDATE_INCOMING_ORDER: 'UPDATE_INCOMING_ORDER',"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Events updated');
