const fs = require('fs');
let content = fs.readFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', 'utf8');

content = content.replace(
  `label={<span>HSN Code <span className="text-red-500">*</span></span>}`,
  `label="HSN Code"\n                    required`
);

content = content.replace(
  `label={<span>Tax Rate (GST) <span className="text-red-500">*</span></span>}`,
  `label="Tax Rate (GST)"\n                    required`
);

content = content.replace(
  `label={<span>Unit of Measurement <span className="text-red-500">*</span></span>}`,
  `label="Unit of Measurement"\n                    required`
);

fs.writeFileSync('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx', content);
console.log('done');
