const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/enrich-so.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { buildZohoCustomFieldsPayload } from '@/lib/zoho-custom-fields';\n", "");
content = content.replace("import { lockZohoSalesOrder } from '@/lib/zoho-sales-order-lock';\n", "");

const lockBlock = /\s*\/\/ Kick off lock workflow asynchronously[\s\S]*?\}\);/;
content = content.replace(lockBlock, "");

fs.writeFileSync(file, content, 'utf8');
console.log('enrich-so.ts patched');
