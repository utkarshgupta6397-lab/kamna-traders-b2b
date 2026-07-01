const fs = require('fs');
const path = 'src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Add disabled attribute
content = content.replace(/(<(?:input|select|textarea)(?!\s+disabled)[^>]*?)(\/?>)/g, '$1 disabled={mode === "VIEW"} $2');

// 2. Modify inputClasses and selectClasses
const inputClassesReplacement = `  const isView = mode === 'VIEW';
  const inputClasses = isView 
    ? "w-full text-sm font-medium text-gray-900 bg-transparent border-transparent px-0 py-1.5 cursor-default focus:outline-none appearance-none pointer-events-none" 
    : "w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300";
    
  const selectClasses = isView
    ? "w-full text-sm font-medium text-gray-900 bg-transparent border-transparent px-0 py-1.5 cursor-default focus:outline-none appearance-none pointer-events-none" 
    : "w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300";
`;
content = content.replace(/const inputClasses = "[^"]+";/, inputClassesReplacement);

// 3. Hide buttons when isView
const buttonsToHide = [
    /(<button\s+type="button"\s+onClick=\{addPanelRow\}.*?<\/button>)/gs,
    /(<button\s+type="button"\s+onClick=\{addInverterRow\}.*?<\/button>)/gs,
    /(<button\s+type="button"\s+onClick=\{.*?removePanelRow.*?\}.*?<\/button>)/gs,
    /(<button\s+type="button"\s+onClick=\{.*?removeInverterRow.*?\}.*?<\/button>)/gs,
    /(<button\s+type="button"\s+onClick=\{.*?removeImage.*?\}.*?<\/button>)/gs,
    /(<button\s+type="button"\s+onClick=\{.*?setCity.*?\}.*?<\/button>)/gs,
    /(<button\s+type="button"\s+onClick=\{.*?setSubVendorId.*?\}.*?<\/button>)/gs,
    /(<button[^>]*?onClick=\{.*?setSelectedZohoCustomer.*?\}.*?<\/button>)/gs
];

buttonsToHide.forEach(regex => {
    content = content.replace(regex, '{!isView && ($1)}');
});

// 4. Hide file drop zone and form buttons if VIEW mode
const footerReplacement = `          </div>
        </div>
      </form>
      
      {/* Sticky Footer for EDIT mode */}
      {mode === 'EDIT' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50 flex justify-end gap-4">
           <div className="flex-1 text-red-500 font-medium px-4 py-2">
             You have unsaved changes.
           </div>
           <button type="button" onClick={() => window.location.reload()} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Cancel</button>
           <button type="button" onClick={handleConfirmSubmit} disabled={loading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
             {loading && <Loader2 size={16} className="animate-spin" />} Save Changes
           </button>
        </div>
      )}
`;
content = content.replace(/<\/form>\s*$/, footerReplacement);

// Change the main Save button to only show in CREATE mode
// Wait, the main submit order button is near the end: 
// <button type="button" onClick={handlePreview} className="...">Preview & Submit</button>
content = content.replace(/(<button\s+type="button"\s+onClick=\{handlePreview\}[^>]*>.*?<\/button>)/gs, '{mode === "CREATE" && ($1)}');

fs.writeFileSync(path, content);
