const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lib/enrich-so.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /totalItems,(\s+)totalTax,(\s+)zohoDetailsJson/;
const replacement = 'totalItems,$1totalTax,$2totalUniqueRows: Array.isArray(so.line_items) ? so.line_items.length : 0,$2customerId: so.customer_id,$2customerGst: so.gst_no || so.gst_number || "",$2zohoDetailsJson';

content = content.replace(regex, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('enrich-so.ts updated.');
