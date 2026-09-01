const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/db.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\/\/ Force reload of PrismaClient in dev to pick up new generated schema\nif \(process\.env\.NODE_ENV !== 'production'\) \{\n  delete \(globalForPrisma as any\)\.prisma;\n\}\n/,
  ''
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed DB connection leak in db.ts');
