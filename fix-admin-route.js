const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/api/admin/incoming-so/[salesorder_id]/zoho-details/route.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '{ params }: { params: { salesorder_id: string } }',
  '{ params }: { params: Promise<{ salesorder_id: string }> }'
);
content = content.replace(
  'const { salesorder_id } = params;',
  'const { salesorder_id } = await params;'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed admin route for Next.js 15');
