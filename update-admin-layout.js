const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/admin/layout.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add import
if (!content.includes('GlobalDispatchNotifier')) {
  content = content.replace(
    "import { Toaster } from 'react-hot-toast';",
    "import { Toaster } from 'react-hot-toast';\nimport GlobalDispatchNotifier from '@/components/GlobalDispatchNotifier';"
  );
  
  // Add component
  content = content.replace(
    '<Toaster position="top-right" />',
    '<Toaster position="top-right" />\n      <GlobalDispatchNotifier />'
  );
  
  fs.writeFileSync(file, content, 'utf8');
  console.log('Admin layout updated.');
}
