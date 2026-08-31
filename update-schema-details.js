const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prisma/schema.prisma');
let content = fs.readFileSync(filePath, 'utf8');

// We need to add the new fields to DispatchIncomingOrder
const regex = /totalTax\s+Float\?/;
content = content.replace(regex, 'totalTax              Float?\n  detailsStatus         String   @default("PENDING")\n  detailsFetchedAt      DateTime?\n  detailsFetchError     String?');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Schema updated.');
