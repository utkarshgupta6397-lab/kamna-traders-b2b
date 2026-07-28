const fs = require('fs');

const path = 'src/app/staff/dashboard/catalog-pricing/products/ProductListPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// The line is: {variant.trackInventory ? <CheckCircle2 size={16} className="text-indigo-500" title="Inventory Tracked"/> : <X size={16} className="text-gray-300" title="Not Tracked"/>}
// And: {variant.trackSerials && <Tag size={16} className="text-cyan-500" title="Serial Enabled"/>}

content = content.replace(
  '<CheckCircle2 size={16} className="text-indigo-500" title="Inventory Tracked"/>',
  '<span title="Inventory Tracked"><CheckCircle2 size={16} className="text-indigo-500" /></span>'
);

content = content.replace(
  '<X size={16} className="text-gray-300" title="Not Tracked"/>',
  '<span title="Not Tracked"><X size={16} className="text-gray-300" /></span>'
);

content = content.replace(
  '<Tag size={16} className="text-cyan-500" title="Serial Enabled"/>',
  '<span title="Serial Enabled"><Tag size={16} className="text-cyan-500" /></span>'
);

fs.writeFileSync(path, content);
console.log('done');
