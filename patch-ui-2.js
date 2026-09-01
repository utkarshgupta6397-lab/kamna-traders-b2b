const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

// Insert states
const statesBlock = `  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());
  const [lockModalOrder, setLockModalOrder] = useState<DispatchIncomingOrder | null>(null);
  const [lockDetails, setLockDetails] = useState<any>(null);
  const [loadingLockDetails, setLoadingLockDetails] = useState(false);`;

content = content.replace("  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());", statesBlock);

// Insert fetchLockDetails function & renderLockIcon & modal rendering
const helperFunctions = `
  const handleLockOrder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLockingIds(prev => new Set(prev).add(id));
      const res = await fetch(\`/api/dispatch/incoming-orders/\${id}/lock\`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to lock order');
      }
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      toast.success('Zoho lock verification completed.');
    } catch (err: any) {
      toast.error(err.message || 'Lock operation failed');
    } finally {
      setLockingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openLockModal = async (order: DispatchIncomingOrder) => {
    setLockModalOrder(order);
    setLoadingLockDetails(true);
    setLockDetails(null);
    try {
      const res = await fetch(\`/api/dispatch/incoming-orders/\${order.id}/lock-details\`);
      if (res.ok) {
        const json = await res.json();
        setLockDetails(json);
      } else {
        toast.error('Failed to load lock diagnostics');
      }
    } catch (err) {
      toast.error('Network error loading lock details');
    } finally {
      setLoadingLockDetails(false);
    }
  };

  const renderLockIcon = (order: DispatchIncomingOrder) => {
    const status = order.zohoLockStatus;
    
    let Icon = Lock;
    let iconClass = "text-gray-400";
    let tooltip = "Lock has not been attempted";
    
    if (status === 'SUCCESS') {
      Icon = Lock;
      iconClass = "text-emerald-500 bg-emerald-50 border-emerald-200";
      tooltip = "Zoho Books lock verified";
    } else if (status === 'VERIFICATION_FAILED') {
      Icon = Unlock;
      iconClass = "text-amber-500 bg-amber-50 border-amber-200";
      tooltip = "Lock update was not verified in Zoho Books";
    } else if (status === 'FAILED') {
      Icon = AlertCircle;
      iconClass = "text-red-500 bg-red-50 border-red-200";
      tooltip = "Zoho Books lock update failed";
    } else if (status === 'PENDING') {
      Icon = Loader2;
      iconClass = "text-blue-500 bg-blue-50 border-blue-200 animate-spin";
      tooltip = "Lock operation in progress";
    }

    return (
      <button 
        onClick={(e) => { e.stopPropagation(); openLockModal(order); }}
        className={\`p-1 rounded-md border flex items-center justify-center transition-colors \${iconClass}\`}
        title={tooltip}
      >
        <Icon size={14} className={status !== 'PENDING' ? '' : 'animate-spin'} />
      </button>
    );
  };
`;

content = content.replace("  const filteredOrders = useMemo", helperFunctions + "\n  const filteredOrders = useMemo");

// Update status td
const oldTd = `<div className="flex flex-col gap-2 items-start">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        {order.status}
                      </span>
                      {(!order.detailsStatus || order.detailsStatus === 'PENDING' || order.detailsStatus === 'FAILED') && (
                        <button
                          onClick={() => handleFetchDetails(order.id)}
                          disabled={fetchingIds.has(order.id)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
                        >
                          <RefreshCw size={12} className={fetchingIds.has(order.id) ? 'animate-spin text-blue-600' : 'text-gray-400'} />
                          {fetchingIds.has(order.id) ? 'Fetching...' : 'Fetch Details'}
                        </button>
                      )}
                    </div>`;

const newTd = `<div className="flex flex-col gap-2 items-start">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          {order.status}
                        </span>
                        {renderLockIcon(order)}
                      </div>
                      
                      {(!order.detailsStatus || order.detailsStatus === 'PENDING' || order.detailsStatus === 'FAILED') && (
                        <button
                          onClick={() => handleFetchDetails(order.id)}
                          disabled={fetchingIds.has(order.id)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
                        >
                          <RefreshCw size={12} className={fetchingIds.has(order.id) ? 'animate-spin text-blue-600' : 'text-gray-400'} />
                          {fetchingIds.has(order.id) ? 'Fetching...' : 'Fetch Details'}
                        </button>
                      )}
                      
                      {order.zohoLockStatus !== 'SUCCESS' && order.zohoLockStatus !== 'PENDING' && (
                        <button
                          onClick={(e) => handleLockOrder(order.id, e)}
                          disabled={lockingIds.has(order.id)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mt-1"
                        >
                          <Lock size={12} className={lockingIds.has(order.id) ? 'animate-pulse text-amber-500' : 'text-gray-400'} />
                          {lockingIds.has(order.id) ? 'Locking...' : (order.zohoLockStatus === 'NOT_ATTEMPTED' || !order.zohoLockStatus) ? 'Lock in Zoho' : 'Retry Lock'}
                        </button>
                      )}
                    </div>`;

content = content.replace(oldTd, newTd);

// Add modal JSX at bottom
const modalJsx = `
      {lockModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Lock size={18} className="text-[#1A2766]" />
                Lock Diagnostics: {lockModalOrder.salesorderNumber || lockModalOrder.zohoSalesorderId}
              </h3>
              <button 
                onClick={() => setLockModalOrder(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors bg-white hover:bg-gray-100 rounded-full p-1 border border-gray-200"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loadingLockDetails ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-500">
                  <Loader2 size={24} className="animate-spin text-[#1A2766]" />
                  <p>Loading diagnostic details from secure vault...</p>
                </div>
              ) : lockDetails ? (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={\`p-4 rounded-lg border flex flex-col gap-1 \${
                    lockDetails.zohoLockStatus === 'SUCCESS' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    lockDetails.zohoLockStatus === 'VERIFICATION_FAILED' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    lockDetails.zohoLockStatus === 'FAILED' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-gray-50 border-gray-200 text-gray-800'
                  }\`}>
                    <div className="font-bold text-sm uppercase tracking-wide">
                      Status: {lockDetails.zohoLockStatus || 'NOT_ATTEMPTED'}
                    </div>
                    {lockDetails.zohoLockError && (
                      <div className="text-sm mt-1">{lockDetails.zohoLockError}</div>
                    )}
                  </div>
                  
                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border rounded-lg p-3 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Last Attempted</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {lockDetails.zohoLockAttemptedAt ? format(new Date(lockDetails.zohoLockAttemptedAt), 'dd MMM yyyy, hh:mm:ss a') : 'Never'}
                      </div>
                    </div>
                    <div className="bg-white border rounded-lg p-3 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Last Verified</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {lockDetails.zohoLockVerifiedAt ? format(new Date(lockDetails.zohoLockVerifiedAt), 'dd MMM yyyy, hh:mm:ss a') : 'Never'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Value: {lockDetails.zohoLockValue === true ? 'true' : lockDetails.zohoLockValue === false ? 'false' : 'null'}</div>
                    </div>
                  </div>
                  
                  {/* JSON Payloads */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                        <FileDown size={14} /> PUT Request Payload
                      </h4>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-40">
                        {lockDetails.zohoLockRequestJson ? JSON.stringify(lockDetails.zohoLockRequestJson, null, 2) : 'No payload recorded'}
                      </pre>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                        <FileDown size={14} /> PUT Response (HTTP {lockDetails.zohoLockHttpStatus || '—'})
                      </h4>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-40">
                        {lockDetails.zohoLockPutResponseJson ? JSON.stringify(lockDetails.zohoLockPutResponseJson, null, 2) : 'No response recorded'}
                      </pre>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                        <FileDown size={14} /> Verification GET Response
                      </h4>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto max-h-64">
                        {lockDetails.zohoLockVerificationResponseJson ? JSON.stringify(lockDetails.zohoLockVerificationResponseJson, null, 2) : 'No verification response recorded'}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-red-500 font-medium">Failed to load details.</div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setLockModalOrder(null)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}`;

content = content.replace("    </div>\n  );\n}", modalJsx + "\n    </div>\n  );\n}");

fs.writeFileSync(file, content, 'utf8');
console.log('UI Patched step 2');
