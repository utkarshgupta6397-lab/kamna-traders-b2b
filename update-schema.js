const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prisma/schema.prisma');
let content = fs.readFileSync(filePath, 'utf8');

// Add totalItems and totalTax
const regex = /total\s+Float\?/;
content = content.replace(regex, 'total                 Float?\n  totalItems            Int?\n  totalTax              Float?');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Schema updated.');
