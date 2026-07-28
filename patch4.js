const fs = require('fs');
let content = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', 'utf8');

// 1. Update handleNextStep
content = content.replace(
  `    if (currentStep === 2) {
      if (!formData.incentiveTag) {
        return;
      }
    }`,
  `    if (currentStep === 2) {
      if (!formData.hsnCodeId || !formData.taxRateId || !formData.unitId || !formData.purchasePrice || !formData.sellingPrice || !formData.incentiveTag) {
        return;
      }
      if (formData.purchasePrice <= 0 || formData.sellingPrice <= formData.purchasePrice) {
        return;
      }
    }`
);

// 2. Update Margin thresholds
content = content.replace(
  `      if (margin >= 30) suggested = 'High Margin Product';
      else if (margin >= 15) suggested = 'Medium Margin Product';
      else suggested = 'Low Margin Product';`,
  `      if (margin > 10) suggested = 'High Margin Product';
      else if (margin > 5) suggested = 'Medium Margin Product';
      else suggested = 'Low Margin Product';`
);

// 3. UI Updates: Add * to labels and inline errors
content = content.replace(
  `label="HSN Code"`,
  `label={<span>HSN Code <span className="text-red-500">*</span></span>}`
);
content = content.replace(
  `label="Tax Rate (GST)"`,
  `label={<span>Tax Rate (GST) <span className="text-red-500">*</span></span>}`
);
content = content.replace(
  `label="Unit of Measurement"`,
  `label={<span>Unit of Measurement <span className="text-red-500">*</span></span>}`
);

// HSN Error
content = content.replace(
  `                  {/* HSN Helper Card */}`,
  `                  {showErrors && !formData.hsnCodeId && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}\n                  {/* HSN Helper Card */}`
);

// Tax Rate Error
content = content.replace(
  `                    clearable
                  />
                </div>`,
  `                    clearable
                  />
                  {showErrors && !formData.taxRateId && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                </div>`
); // Note: This will apply to both Tax Rate and Unit. Wait, let's be more specific.

const taxBlockOld = `                {/* Tax Rate — name only */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label={<span>Tax Rate (GST) <span className="text-red-500">*</span></span>}
                    endpoint="/api/staff/catalog/tax-rates"
                    value={formData.taxRateId}
                    onChange={val => updateForm('taxRateId', val || '')}
                    displayValue={taxDisplay}
                    renderOption={opt => (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">{opt.name}</span>
                        {opt.percentage !== undefined && (
                          <span className="text-[12px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{opt.percentage}%</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                </div>`;
const taxBlockNew = `                {/* Tax Rate — name only */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label={<span>Tax Rate (GST) <span className="text-red-500">*</span></span>}
                    endpoint="/api/staff/catalog/tax-rates"
                    value={formData.taxRateId}
                    onChange={val => updateForm('taxRateId', val || '')}
                    displayValue={taxDisplay}
                    renderOption={opt => (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">{opt.name}</span>
                        {opt.percentage !== undefined && (
                          <span className="text-[12px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{opt.percentage}%</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                  {showErrors && !formData.taxRateId && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                </div>`;
content = content.replace(taxBlockOld, taxBlockNew);

const unitBlockOld = `                {/* Unit of Measurement */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label={<span>Unit of Measurement <span className="text-red-500">*</span></span>}
                    endpoint="/api/staff/catalog/units"
                    value={formData.unitId}
                    onChange={val => updateForm('unitId', val || '')}
                    displayValue={uomDisplay}
                    renderOption={opt => (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">{opt.name}</span>
                        {opt.abbreviation && (
                          <span className="text-[12px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{opt.abbreviation}</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                </div>`;
const unitBlockNew = `                {/* Unit of Measurement */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label={<span>Unit of Measurement <span className="text-red-500">*</span></span>}
                    endpoint="/api/staff/catalog/units"
                    value={formData.unitId}
                    onChange={val => updateForm('unitId', val || '')}
                    displayValue={uomDisplay}
                    renderOption={opt => (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">{opt.name}</span>
                        {opt.abbreviation && (
                          <span className="text-[12px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{opt.abbreviation}</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                  {showErrors && !formData.unitId && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                </div>`;
content = content.replace(unitBlockOld, unitBlockNew);


// Purchase Price
content = content.replace(
  `<label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Purchase Price</label>`,
  `<label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Purchase Price <span className="text-red-500">*</span></label>`
);
content = content.replace(
  `className="w-full pl-7 pr-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm"
                      placeholder="0.00"
                      value={formData.purchasePrice || ''}
                      onChange={e => updateForm('purchasePrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>`,
  `className={\`w-full pl-7 pr-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm \${showErrors && (!formData.purchasePrice || formData.purchasePrice <= 0) ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}\`}
                      placeholder="0.00"
                      value={formData.purchasePrice || ''}
                      onChange={e => updateForm('purchasePrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {showErrors && (!formData.purchasePrice || formData.purchasePrice <= 0) && <p className="text-red-500 text-xs mt-1.5">Purchase Price must be greater than ₹0.</p>}
                </div>`
);

// Selling Price
content = content.replace(
  `<label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Selling Price</label>`,
  `<label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Selling Price <span className="text-red-500">*</span></label>`
);
content = content.replace(
  `className="w-full pl-7 pr-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm"
                      placeholder="0.00"
                      value={formData.sellingPrice || ''}
                      onChange={e => updateForm('sellingPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>`,
  `className={\`w-full pl-7 pr-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm \${showErrors && (!formData.sellingPrice || formData.sellingPrice <= formData.purchasePrice) ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}\`}
                      placeholder="0.00"
                      value={formData.sellingPrice || ''}
                      onChange={e => updateForm('sellingPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {showErrors && (!formData.sellingPrice || formData.sellingPrice <= formData.purchasePrice) && <p className="text-red-500 text-xs mt-1.5">Selling Price must be greater than Purchase Price.</p>}
                </div>`
);

// Incentive Tag error message update
content = content.replace(
  `{showErrors && !formData.incentiveTag && <p className="text-red-500 text-xs mt-1.5">Incentive Tag is required</p>}`,
  `{showErrors && !formData.incentiveTag && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}`
);

fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', content);
console.log('done');
