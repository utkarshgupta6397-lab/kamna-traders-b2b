const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the inline enrichSalesOrder function
content = content.replace(/async function enrichSalesOrder[\s\S]*?export async function POST/, `import { enrichSalesOrder } from '@/lib/enrich-so';\n\nexport async function POST`);

// Remove unused imports
content = content.replace("import { getZohoOrgId, getZohoTokens } from '@/lib/zoho-auth';", "");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Route simplified.');
