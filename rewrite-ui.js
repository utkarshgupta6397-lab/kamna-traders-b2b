const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

// Update Interface
content = content.replace(
  '  salesorderNumber: string | null;\n  customerName: string | null;',
  '  salesorderNumber: string | null;\n  customerId: string | null;\n  customerName: string | null;\n  customerGst: string | null;'
);
content = content.replace(
  '  totalItems: number | null;',
  '  totalItems: number | null;\n  totalUniqueRows: number | null;'
);

// We need to use date-fns to format the date
if (!content.includes('import { format }')) {
  content = content.replace("import { Search", "import { format } from 'date-fns';\nimport { Search");
}

// Replace the table header and body
const tableRegex = /<table className="w-full[\s\S]*<\/table>/;
const newTable = `<table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Sales Order</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Customer</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Amount</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Total Items</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-gray-400" />
                      <span className="text-sm">Loading incoming queue...</span>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center max-w-md mx-auto">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                        <Inbox size={32} className="text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">Queue is empty</h3>
                      <p className="text-sm text-gray-500 mt-2">
                        Sales Orders pushed from Zoho Books will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm">No results match your search.</span>
                  )}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className={\`hover:bg-gray-50/50 transition-colors duration-1000 \${highlightedRow === order.id ? 'bg-blue-50' : ''}\`}
                >
                  <td className="px-6 py-4">
                    {order.salesorderNumber ? (
                      <a href={\`https://books.zoho.in/app#/salesorders/\${order.zohoSalesorderId}\`} target="_blank" rel="noreferrer" className="font-bold text-[#1A2766] hover:underline cursor-pointer">
                        {order.salesorderNumber}
                      </a>
                    ) : (
                      <div className="font-bold text-gray-900">{order.zohoSalesorderId}</div>
                    )}
                    <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {order.zohoSalesorderId}</div>
                  </td>
                  <td className="px-6 py-4">
                    {order.customerName ? (
                      <a href={\`https://books.zoho.in/app#/contacts/\${order.customerId || ''}\`} target="_blank" rel="noreferrer" className="font-medium text-[#1A2766] hover:underline cursor-pointer">
                        {order.customerName}
                      </a>
                    ) : (
                      <span className="text-gray-400 italic">Unknown Customer</span>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">
                      {order.customerGst ? \`GST: \${order.customerGst}\` : 'GST: —'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-gray-900">
                      {order.total !== null ? formatCurrency(order.total, order.currencyCode || 'INR') : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Tax: {order.totalTax !== null ? formatCurrency(order.totalTax, order.currencyCode || 'INR') : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-gray-900">
                      {order.totalItems !== null ? order.totalItems : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Unique Rows: {order.totalUniqueRows !== null ? order.totalUniqueRows : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(order.receivedAt), 'dd-MMM-yyyy hh:mm a')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2 items-start">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        {order.status}
                      </span>
                      {(!order.detailsStatus || order.detailsStatus === 'PENDING' || order.detailsStatus === 'FAILED') && (
                        <button
                          onClick={() => handleManualFetch(order.id)}
                          disabled={fetchingIds.has(order.id)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
                        >
                          <RefreshCw size={12} className={fetchingIds.has(order.id) ? 'animate-spin text-blue-600' : 'text-gray-400'} />
                          {fetchingIds.has(order.id) ? 'Fetching...' : 'Fetch Details'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>`;

content = content.replace(tableRegex, newTable);
fs.writeFileSync(file, content, 'utf8');
console.log('UI Rewritten successfully.');
