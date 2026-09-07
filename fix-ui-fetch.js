const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add fetching state to component
content = content.replace(
  'const [highlightedRow, setHighlightedRow] = useState<string | null>(null);',
  'const [highlightedRow, setHighlightedRow] = useState<string | null>(null);\n  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());'
);

// 2. Add handleFetchDetails function
const handleFetchDetails = `  const handleFetchDetails = async (id: string) => {
    setFetchingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(\`/api/dispatch/incoming-queue/\${id}/fetch\`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch details');
      }
      toast.success('Sales Order details fetched successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Unable to fetch Sales Order details from Zoho Books. Please try again.');
    } finally {
      setFetchingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };`;

content = content.replace(
  'const newCount = orders.filter(o => o.status === \'NEW\').length;',
  handleFetchDetails + '\n\n  const newCount = orders.filter(o => o.status === \'NEW\').length;'
);

// 3. Add Action Column Header
const oldHeaders = `<th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Status</th>`;
const newHeaders = `<th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Received At</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">Status</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 text-right">Action</th>`;
content = content.replace(oldHeaders, newHeaders);

// 4. Increase colspan for empty state
content = content.replace(/colSpan=\{7\}/g, 'colSpan={8}');

// 5. Render Action Button logic
// Replace the Status cell and add the Action cell below it
const oldStatusCell = `<td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {order.status}
                    </span>
                  </td>
                </tr>`;

const newStatusCell = `<td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {(!order.customerName || !order.total || (order as any).detailsStatus === 'FAILED') ? (
                      <button
                        onClick={() => handleFetchDetails(order.id)}
                        disabled={fetchingIds.has(order.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {fetchingIds.has(order.id) ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Fetching...
                          </>
                        ) : (
                          <>
                            <svg className="-ml-1 mr-2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {(order as any).detailsStatus === 'FAILED' ? 'Retry Fetch' : 'Fetch Details'}
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Details Loaded</span>
                    )}
                  </td>
                </tr>`;

content = content.replace(oldStatusCell, newStatusCell);

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI updated with fetch action.');
