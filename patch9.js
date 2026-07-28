const fs = require('fs');
let content = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', 'utf8');

// 1. handleNextStep
const oldNextStep = `    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.categoryId || !formData.type || !formData.brandId || !formData.manufacturerId || !formData.code.trim()) {
        return;
      }
    }`;
const newNextStep = `    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.categoryId || !formData.type || !formData.brandId || !formData.manufacturerId || !formData.code.trim()) {
        return;
      }
      if (!/^[a-zA-Z0-9\\s\\-/\\.\\(\\)\\&+]+$/.test(formData.name.trim())) return;
      if (!/^[A-Z0-9]{4,20}$/.test(formData.code.trim())) return;
    }`;
content = content.replace(oldNextStep, newNextStep);

// 2. handleSave
const oldSave = `    if (!formData.name.trim() || !formData.categoryId || !formData.type || !formData.brandId || !formData.manufacturerId || !formData.code.trim()) {
      toast.error('Please fill in all mandatory fields');
      setCurrentStep(1);
      return;
    }`;
const newSave = `    if (!formData.name.trim() || !formData.categoryId || !formData.type || !formData.brandId || !formData.manufacturerId || !formData.code.trim()) {
      toast.error('Please fill in all mandatory fields');
      setCurrentStep(1);
      return;
    }
    if (!/^[a-zA-Z0-9\\s\\-/\\.\\(\\)\\&+]+$/.test(formData.name.trim()) || !/^[A-Z0-9]{4,20}$/.test(formData.code.trim())) {
      toast.error('Product Name or SKU contains invalid characters');
      setCurrentStep(1);
      return;
    }`;
content = content.replace(oldSave, newSave);

// 3. Product Name Input
const oldNameInput = `                    className={\`w-full px-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm \${showErrors && !formData.name.trim() ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}\`}
                    placeholder="e.g., Luminous Inverter 1000VA"
                    value={formData.name}
                    onChange={e => updateForm('name', e.target.value)}
                  />
                </div>`;
const newNameInput = `                    className={\`w-full px-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm \${showErrors && (!formData.name.trim() || !/^[a-zA-Z0-9\\s\\-/\\.\\(\\)\\&+]+$/.test(formData.name.trim())) ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}\`}
                    placeholder="e.g., Luminous Inverter 1000VA"
                    value={formData.name}
                    onChange={e => updateForm('name', e.target.value.replace(/\\s{2,}/g, ' '))}
                  />
                  {showErrors && !formData.name.trim() && <p className="text-red-500 text-xs mt-1.5">This field is required.</p>}
                  {showErrors && formData.name.trim() && !/^[a-zA-Z0-9\\s\\-/\\.\\(\\)\\&+]+$/.test(formData.name.trim()) && <p className="text-red-500 text-xs mt-1.5">Product Name contains unsupported characters.</p>}
                </div>`;
content = content.replace(oldNameInput, newNameInput);

// 4. SKU Input
const oldSkuInput = `                    <input
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

const newSkuInput = `                    <input
                      type="text"
                      className={\`w-full pl-3 pr-24 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm uppercase font-mono tracking-wider \${showErrors && (!formData.code.trim() || !/^[A-Z0-9]{4,20}$/.test(formData.code.trim())) ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}\`}
                      placeholder="e.g., A9K2P1"
                      value={formData.code}
                      onChange={e => updateForm('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
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
                  {showErrors && formData.code.trim() && !/^[A-Z0-9]{4,20}$/.test(formData.code.trim()) && <p className="text-red-500 text-xs mt-1.5">SKU must be 4-20 alphanumeric characters.</p>}
                </div>`;

content = content.replace(oldSkuInput, newSkuInput);

fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', content);
console.log('done');
