const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/lib/enrich-so.ts');
let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes('lockZohoSalesOrder')) {
  content = content.replace(
    "import { buildZohoCustomFieldsPayload } from '@/lib/zoho-custom-fields';",
    "import { buildZohoCustomFieldsPayload } from '@/lib/zoho-custom-fields';\nimport { lockZohoSalesOrder } from '@/lib/zoho-sales-order-lock';"
  );
}

// Replace the old inline logic with the new service call
const oldLogicPattern = /\/\/ --- STEP 3-5: CUSTOM FIELD UPDATE PUT ---[\s\S]*?\/\/ -----------------------------------------/;

const newLogic = `// Kick off lock workflow asynchronously (does not block enrichment flow)
    lockZohoSalesOrder(dbId, salesorderId).catch(err => {
      console.error(\`[INCOMING SO][\${requestId}] Uncaught error in lock workflow:\`, err);
    });`;

content = content.replace(oldLogicPattern, newLogic);
fs.writeFileSync(file, content, 'utf8');
console.log('enrich-so.ts updated.');
