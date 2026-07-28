const fs = require('fs');
let content = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', 'utf8');

// 1. handleNextStep
content = content.replace(
  `    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.categoryId || !formData.type) {
        return;
      }
    }`,
  `    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.categoryId || !formData.type || !formData.brandId || !formData.manufacturerId || !formData.code.trim()) {
        return;
      }
    }`
);

// 2. handleSave
content = content.replace(
  `    if (!formData.name.trim() || !formData.categoryId || !formData.type) {
      toast.error('Please fill in all mandatory fields');
      setCurrentStep(1);
      return;
    }`,
  `    if (!formData.name.trim() || !formData.categoryId || !formData.type || !formData.brandId || !formData.manufacturerId || !formData.code.trim()) {
      toast.error('Please fill in all mandatory fields');
      setCurrentStep(1);
      return;
    }`
);

// 3. SKU Input
const skuOld = `                {/* SKU / Product Code */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
                    SKU <span className="text-gray-400 font-normal">— auto-generates if empty</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      className="w-full pl-3 pr-24 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm uppercase font-mono tracking-wider"
                      placeholder="e.g., A9K2P1"
                      value={formData.code}
                      onChange={e => updateForm('code', e.target.value.toUpperCase())}
                      maxLength={20}
                    />
                    <div className="absolute right-1">
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        disabled={isGeneratingSku}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-40"
                      >
                        {isGeneratingSku ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        Generate
                      </button>
                    </div>
                  </div>
                </div>`;

const skuNew = `                {/* SKU / Product Code */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      className={\`w-full pl-3 pr-24 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm uppercase font-mono tracking-wider \${showErrors && !formData.code.trim() ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}\`}
                      placeholder="e.g., A9K2P1"
                      value={formData.code}
                      onChange={e => updateForm('code', e.target.value.toUpperCase())}
                      maxLength={20}
                    />
                    <div className="absolute right-1">
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        disabled={isGeneratingSku}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-40"
                      >
                        {isGeneratingSku ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        Generate
                      </button>
                    </div>
                  </div>
                  {showErrors && !formData.code.trim() && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                </div>`;

content = content.replace(skuOld, skuNew);

// 4. Brand & Manufacturer
const brandOld = `                {/* Brand */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Brand"
                    endpoint="/api/staff/catalog/brands"
                    value={formData.brandId}
                    onChange={val => updateForm('brandId', val || '')}
                    displayValue={brandDisplay}
                    clearable
                  />
                </div>`;
                
const brandNew = `                {/* Brand */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Brand"
                    required
                    endpoint="/api/staff/catalog/brands"
                    value={formData.brandId}
                    onChange={val => updateForm('brandId', val || '')}
                    displayValue={brandDisplay}
                    clearable
                  />
                  {showErrors && !formData.brandId && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                </div>`;

content = content.replace(brandOld, brandNew);

const mfrOld = `                {/* Manufacturer */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Manufacturer"
                    endpoint="/api/staff/catalog/manufacturers"
                    value={formData.manufacturerId}
                    onChange={val => updateForm('manufacturerId', val || '')}
                    displayValue={mfrDisplay}
                    clearable
                  />
                </div>`;
                
const mfrNew = `                {/* Manufacturer */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Manufacturer"
                    required
                    endpoint="/api/staff/catalog/manufacturers"
                    value={formData.manufacturerId}
                    onChange={val => updateForm('manufacturerId', val || '')}
                    displayValue={mfrDisplay}
                    clearable
                  />
                  {showErrors && !formData.manufacturerId && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                </div>`;

content = content.replace(mfrOld, mfrNew);

fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', content);
console.log('done');
