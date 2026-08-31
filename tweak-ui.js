const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace {order.salesorderNumber || 'Pending'} with {order.salesorderNumber || order.zohoSalesorderId}
// Actually, in the current code, it's: <div className="font-bold text-gray-900">{order.salesorderNumber || 'Pending'}</div>
// And the ID is shown below it as well. Let's make it show the ID as the main text if SO is missing, and the ID below as well (or "Enriching..." below).
// Wait, the prompt says:
// "Primary text: Actual Zoho Books Sales Order Number ... Secondary smaller text: ID: actual salesorder_id ... Do not show "Pending" as the Sales Order value."
// And "temporarily fall back to salesOrderId if detail enrichment has not completed yet".

content = content.replace(
  /<div className="font-bold text-gray-900">\{order\.salesorderNumber \|\| 'Pending'\}<\/div>/g,
  '<div className="font-bold text-gray-900">{order.salesorderNumber || order.zohoSalesorderId}</div>'
);

// If amount is missing, show '—'
content = content.replace(
  /order\.total !== null \? formatCurrency\(order\.total, order\.currencyCode \|\| 'INR'\) : '-'/g,
  "order.total !== null ? formatCurrency(order.total, order.currencyCode || 'INR') : '—'"
);

// If tax is missing, show '—' 
content = content.replace(
  /order\.totalTax !== null \? formatCurrency\(order\.totalTax, order\.currencyCode \|\| 'INR'\) : '-'/g,
  "order.totalTax !== null ? formatCurrency(order.totalTax, order.currencyCode || 'INR') : '—'"
);

// If totalItems is missing, show '—'
content = content.replace(
  /order\.totalItems !== null \? order\.totalItems : '-'/g,
  "order.totalItems !== null ? order.totalItems : '—'"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI tweaked');
