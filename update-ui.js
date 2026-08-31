const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Interface
content = content.replace(
  /currencyCode: string \| null;/,
  'currencyCode: string | null;\n  totalItems: number | null;\n  totalTax: number | null;'
);

// Format Currency Helper
const formatCurrency = `
const formatCurrency = (amount: number, currency: string = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};
`;
// Insert right before export default function
content = content.replace(/export default function IncomingQueueClient/, formatCurrency + '\nexport default function IncomingQueueClient');

// Sound update
content = content.replace(
  /\/sounds\/dispatch-notification\.wav/g,
  '/sounds/dispatch-bell.mp3'
);

// Table headers
const oldHeaders = `<th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Amount</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>`;
const newHeaders = `<th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Amount</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Total Items</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Tax</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>`;
content = content.replace(oldHeaders, newHeaders);

// ColSpan in empty state
content = content.replace(/colSpan=\{5\}/g, 'colSpan={7}');

// Table Rows
const oldRows = `<td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.total !== null ? \\\`\${order.currencyCode} \${order.total.toLocaleString()}\\\` : '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">`;
const newRows = `<td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.total !== null ? formatCurrency(order.total, order.currencyCode || 'INR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.totalItems !== null ? order.totalItems : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.totalTax !== null ? formatCurrency(order.totalTax, order.currencyCode || 'INR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">`;
// Need careful regex replacement for the oldRows
// Since I used backticks in the old code, I'll use a more precise string replacement.

const rowStartIdx = content.indexOf('<td className="px-6 py-4 text-right font-medium text-gray-900">');
if (rowStartIdx !== -1) {
    const rowEndIdx = content.indexOf('<td className="px-6 py-4 text-xs text-gray-500">', rowStartIdx);
    if (rowEndIdx !== -1) {
        // We found the segment to replace
        const toReplace = content.substring(rowStartIdx, rowEndIdx);
        const replacement = `<td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.total !== null ? formatCurrency(order.total, order.currencyCode || 'INR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.totalItems !== null ? order.totalItems : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {order.totalTax !== null ? formatCurrency(order.totalTax, order.currencyCode || 'INR') : '-'}
                  </td>
                  `;
        content = content.replace(toReplace, replacement);
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI updated.');
