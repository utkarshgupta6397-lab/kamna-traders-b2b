const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'prisma/schema.prisma');
let content = fs.readFileSync(filePath, 'utf8');

// Find the DispatchIncomingOrder model
const startIndex = content.indexOf('model DispatchIncomingOrder {');
if (startIndex !== -1) {
  const endIndex = content.indexOf('}', startIndex);
  let modelBody = content.substring(startIndex, endIndex);
  
  modelBody = modelBody.replace(
    /customerName\s+String\?/,
    'customerName          String?\n  customerGst           String?\n  customerId            String?'
  );

  modelBody = modelBody.replace(
    /totalItems\s+Int\?/,
    'totalItems            Int?\n  totalUniqueRows       Int?'
  );

  content = content.substring(0, startIndex) + modelBody + content.substring(endIndex);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Schema updated safely.');
} else {
  console.log('Could not find DispatchIncomingOrder');
}
