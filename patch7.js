const fs = require('fs');
let content = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', 'utf8');

// 1. Add icons
content = content.replace(
  `import {
  Package,`,
  `import {
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Package,`
);

// 2. Add thumbnailBase64 to formData
content = content.replace(
  `incentiveTag:   '',`,
  `incentiveTag:   '',
    thumbnailBase64: '',`
);

// 3. Add hooks for Step 4 dependencies
const step4Hooks = `  // ─── Step 4 Dependencies: Inventory & Product Type ───────────────────────
  useEffect(() => {
    if (formData.type === 'Service') {
      setFormData(prev => ({ ...prev, trackInventory: false, trackSerials: false }));
    }
  }, [formData.type]);

  useEffect(() => {
    if (!formData.trackInventory && formData.trackSerials) {
      setFormData(prev => ({ ...prev, trackSerials: false }));
    }
  }, [formData.trackInventory]);

  // ─── File Upload Logic ───────────────────────────────────────────────────
  const [thumbnailError, setThumbnailError] = useState('');
  
  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setThumbnailError('Unsupported format. Please use JPEG, PNG, or WEBP.');
      return;
    }

    if (file.size > 500 * 1024) {
      setThumbnailError('File exceeds 500 KB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({ ...prev, thumbnailBase64: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };
`;

content = content.replace(
  `  // ─── HSN Helper Logic ──────────────────────────────────────────────────`,
  step4Hooks + `\n  // ─── HSN Helper Logic ──────────────────────────────────────────────────`
);

// 4. Replace Step 4 render block completely
const oldStep4Start = `{currentStep === 3 && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 pb-3 mb-2">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><BarChart2 size={18} /></div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Inventory & Review</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Configure tracking behaviour and add an optional note for the approver.</p>
            </div>
          </div>`;

const oldStep4End = `            </div>
          </div>
        </div>
      )}`;

// We need to carefully slice the string to replace the Step 4 block
const step4Index = content.indexOf(`{currentStep === 3 && (`);
const endOfStep4 = content.indexOf(`</ProductStepForm>`);
if (step4Index === -1 || endOfStep4 === -1) {
  console.log('Could not find step 4 block bounds.');
  process.exit(1);
}

const newStep4 = `{currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 pb-2">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><BarChart2 size={18} /></div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Inventory & Review</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Upload a thumbnail, configure tracking, and add an optional note.</p>
            </div>
          </div>

          {/* CARD 1: Product Thumbnail */}
          <div className="bg-[#FAFBFC] rounded-xl border border-gray-100 p-6">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Product Thumbnail</h3>
            <div className="max-w-sm">
              {!formData.thumbnailBase64 ? (
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleThumbnailUpload}
                  />
                  <div className={\`w-full aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors duration-200 \${thumbnailError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white group-hover:border-blue-400 group-hover:bg-blue-50/30'}\`}>
                    <div className={\`p-3 rounded-full mb-3 \${thumbnailError ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'}\`}>
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-[14px] font-medium text-gray-900 mb-1">Click or drag to upload</p>
                    <p className="text-[12px] text-gray-500 text-center px-4">JPEG, PNG, WEBP (max 500 KB)</p>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-square border rounded-xl overflow-hidden relative group bg-white">
                  <img src={formData.thumbnailBase64} alt="Product Thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleThumbnailUpload}
                      />
                      <button type="button" className="bg-white text-gray-800 p-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors pointer-events-none">
                        <ImageIcon size={18} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, thumbnailBase64: '' }))}
                      className="bg-red-500 text-white p-2 rounded-lg shadow-sm hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )}
              {thumbnailError && <p className="text-red-500 text-xs mt-2">{thumbnailError}</p>}
            </div>
          </div>

          {/* CARD 2: Inventory Tracking */}
          <div className="bg-[#FAFBFC] rounded-xl border border-gray-100 p-6">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Inventory Tracking</h3>
            <div className="space-y-4">
              {/* Track Inventory */}
              <div>
                <label className={\`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 \${formData.type === 'Service' ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : formData.trackInventory ? 'border-blue-200 bg-blue-50/50 shadow-sm cursor-pointer' : 'border-gray-200 hover:bg-white hover:border-gray-300 bg-white cursor-pointer'}\`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 disabled:cursor-not-allowed"
                    checked={formData.trackInventory}
                    onChange={e => updateForm('trackInventory', e.target.checked)}
                    disabled={formData.type === 'Service'}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">Track Inventory</p>
                    <p className="text-[13px] text-gray-500 mt-0.5">Maintain stock counts for this product.</p>
                  </div>
                </label>
                {formData.type === 'Service' && <p className="text-gray-500 text-xs mt-1.5 ml-1">Services do not maintain physical inventory or serial numbers.</p>}
              </div>

              {/* Track Serials */}
              <div>
                <label className={\`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 \${(!formData.trackInventory || formData.type === 'Service') ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : formData.trackSerials ? 'border-blue-200 bg-blue-50/50 shadow-sm cursor-pointer' : 'border-gray-200 hover:bg-white hover:border-gray-300 bg-white cursor-pointer'}\`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 disabled:cursor-not-allowed"
                    checked={formData.trackSerials}
                    onChange={e => updateForm('trackSerials', e.target.checked)}
                    disabled={!formData.trackInventory || formData.type === 'Service'}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">Track Serial Numbers</p>
                    <p className="text-[13px] text-gray-500 mt-0.5">Require serial number scanning on dispatch and inwarding.</p>
                  </div>
                </label>
                {!formData.trackInventory && formData.type !== 'Service' && <p className="text-gray-500 text-xs mt-1.5 ml-1">Serial tracking requires inventory tracking.</p>}
              </div>
            </div>
          </div>

          {/* CARD 3: Approval */}
          <div className="bg-[#FAFBFC] rounded-xl border border-gray-100 p-6">
            <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Approval</h3>
            <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
              Approval Remarks <span className="font-normal text-gray-400">— optional</span>
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm resize-none"
              placeholder="Optional note for the approving manager..."
              value={formData.remarks}
              onChange={e => updateForm('remarks', e.target.value)}
            />
          </div>
        </div>
      )}
`;

content = content.substring(0, step4Index) + newStep4 + '\n      ' + content.substring(endOfStep4);
fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', content);
console.log('done');
