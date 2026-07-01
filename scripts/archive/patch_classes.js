const fs = require('fs');
const path = 'src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx';
let content = fs.readFileSync(path, 'utf8');

const classReplacement = `
  const isView = currentMode === 'VIEW';
  const inputClasses = isView 
    ? "w-full text-sm font-medium text-gray-900 bg-transparent border-transparent px-0 py-1.5 cursor-default focus:outline-none appearance-none pointer-events-none resize-none" 
    : "w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300";
  const selectClasses = isView
    ? "w-full text-sm font-medium text-gray-900 bg-transparent border-transparent px-0 py-1.5 cursor-default focus:outline-none appearance-none pointer-events-none" 
    : "w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300";
`;

content = content.replace(/const inputClasses = "[^"]+";/, classReplacement);
content = content.replace(/const selectClasses = "[^"]+";/, '');

content = content.replace(/className=\{inputClasses\}/g, 'readOnly={isView} disabled={isView} className={inputClasses}');
content = content.replace(/className=\{selectClasses\}/g, 'disabled={isView} className={selectClasses}');

fs.writeFileSync(path, content);
