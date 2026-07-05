const fs = require('fs');
let file = fs.readFileSync('src/app/staff/dashboard/solar-orders/documentation-queue/DocumentationTable.tsx', 'utf8');

file = file.replace(
  'export default function DocumentationTable({',
  'export default function DocumentationTable({ items, ...props }: any) { console.log("STEP 4 - Table Component Received items:", items?.length); window.__DEBUG_STEP_4 = items?.length; return <DocumentationTableInner items={items} {...props} />; }\nfunction DocumentationTableInner({'
);

file = file.replace(
  '<tbody className="divide-y divide-gray-100">',
  '{console.log("STEP 5 - FINAL RENDER (rows length):", items.length) || ""}\n            <tbody className="divide-y divide-gray-100">'
);

fs.writeFileSync('src/app/staff/dashboard/solar-orders/documentation-queue/DocumentationTable.tsx', file);
