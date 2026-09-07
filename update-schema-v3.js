const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prisma/schema.prisma');
let content = fs.readFileSync(filePath, 'utf8');

// Insert new fields after customerName
content = content.replace(
  /customerName\s+String\?/,
  'customerName          String?\n  customerGst           String?\n  customerId            String?'
);

content = content.replace(
  /totalItems\s+Int\?/,
  'totalItems            Int?\n  totalUniqueRows       Int?'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Schema updated.');
