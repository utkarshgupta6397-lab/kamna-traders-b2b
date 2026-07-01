import re

with open('src/app/staff/dashboard/solar-orders/orders/[id]/documentation/DocumentationApprovalStage.tsx', 'r') as f:
    content = f.read()

# 1. Add `Eye` import
if 'Eye,' not in content and 'Eye ' not in content:
    content = content.replace('Download, AlertCircle', 'Download, Eye, AlertCircle')

# 2. Add state for file preview modal inside DocumentationApprovalStage
state_code = """  const [remarks, setRemarks] = useState('');
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  const getDynamicFields = (orderObj: any) => {
    const ignoreKeys = ['id', 'createdAt', 'updatedAt', 'zohoSalesOrderId', 'vendorId', 'salesmanId', 'callingExecutiveId', 'subVendorId'];
    const fields: { label: string, value: any }[] = [];
    
    for (const [key, value] of Object.entries(orderObj)) {
      if (ignoreKeys.includes(key) || value === null || value === undefined || value === '') continue;
      
      // Skip objects and arrays (relations like files, steps, etc.)
      if (typeof value === 'object') continue;
      
      let displayValue = value;
      if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No';
      } else if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price')) {
        displayValue = `₹${Number(value).toLocaleString('en-IN')}`;
      } else if (key.toLowerCase().includes('date') || value instanceof Date) {
        displayValue = new Date(value as any).toLocaleDateString('en-IN');
      }
      
      fields.push({ label: formatLabel(key), value: displayValue });
    }
    
    return fields;
  };
"""
content = content.replace("  const [remarks, setRemarks] = useState('');", state_code)

# 3. Modify Step 2 specific rendering
old_step_2 = """                  {/* Step 2 specifics */}
                  {step.stepKey === 'DOC_2' && (
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                      <div className="font-medium text-gray-500">Customer Name:</div>
                      <div>{order.customerName}</div>
                      <div className="font-medium text-gray-500">Phone:</div>
                      <div>{order.customerPhone}</div>
                      <div className="font-medium text-gray-500">Address:</div>
                      <div className="col-span-2 md:col-span-1">{order.address}, {order.city}, {order.state} {order.pincode}</div>
                      <div className="font-medium text-gray-500">Capacity:</div>
                      <div>{order.capacityKw} kW</div>
                    </div>
                  )}"""

new_step_2 = """                  {/* Step 2 specifics - Dynamic Rendering */}
                  {step.stepKey === 'DOC_2' && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-4">
                      {getDynamicFields(order).map((field, idx) => (
                        <div key={idx} className="flex flex-col">
                          <span className="font-medium text-gray-500 text-xs mb-0.5">{field.label}</span>
                          <span className="text-gray-900 break-words">{String(field.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}"""

content = content.replace(old_step_2, new_step_2)

# 4. Modify File list rendering to include View button
old_file_list = """                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate pr-2" title={file.documentType || file.fileName}>{file.documentType || file.fileName}</span>
                              <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1 rounded transition-colors" title="Download">
                                <Download size={14} />
                              </a>
                            </div>"""

new_file_list = """                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate pr-2" title={file.documentType || file.fileName}>{file.documentType || file.fileName}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setPreviewFile(file)}
                                  className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1 rounded transition-colors flex flex-row items-center gap-1 px-2" 
                                  title="View"
                                >
                                  <Eye size={14} />
                                  <span className="text-[10px] font-bold">View</span>
                                </button>
                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-800 bg-gray-100 p-1 rounded transition-colors flex flex-row items-center gap-1 px-2" title="Download">
                                  <Download size={14} />
                                  <span className="text-[10px] font-bold">Download</span>
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="text-[10px] text-gray-400">
                                 {new Date(file.uploadedAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                               </div>
                            </div>"""

content = content.replace(old_file_list, new_file_list)

# 5. Add File Preview Modal at the bottom
preview_modal = """
      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 md:p-8 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 truncate pr-4">
                {previewFile.documentType || previewFile.fileName}
              </h3>
              <div className="flex items-center gap-3">
                <a 
                  href={previewFile.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                >
                  <Download size={16} />
                  Download
                </a>
                <button 
                  onClick={() => setPreviewFile(null)} 
                  className="text-gray-500 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 relative overflow-hidden flex items-center justify-center p-4">
              {previewFile.fileUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={previewFile.fileUrl} 
                  className="w-full h-full rounded-lg shadow-sm border border-gray-300 bg-white"
                  title="PDF Preview"
                />
              ) : previewFile.fileUrl.toLowerCase().endsWith('.heic') ? (
                <div className="flex flex-col items-center justify-center text-gray-500 gap-4">
                  <AlertCircle size={48} className="text-gray-400" />
                  <div className="text-center">
                    <p className="font-bold text-gray-700">HEIC preview not supported in browser</p>
                    <p className="text-sm">Please download the file to view it.</p>
                  </div>
                  <a href={previewFile.fileUrl} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-sm">
                    Download File
                  </a>
                </div>
              ) : (
                <img 
                  src={previewFile.fileUrl} 
                  alt="Preview" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

content = content.replace("    </div>\n  );\n}", preview_modal)

with open('src/app/staff/dashboard/solar-orders/orders/[id]/documentation/DocumentationApprovalStage.tsx', 'w') as f:
    f.write(content)

