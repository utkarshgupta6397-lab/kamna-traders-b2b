const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/staff/dashboard/dispatch/incoming/IncomingQueueClient.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the injected handleManualFetch that went inside useEffect
content = content.replace(/const handleManualFetch = async[\s\S]*?toast\.error\('Fetch failed'\);\n\s*\} finally \{\n\s*setFetchingIds\(prev => \{\n\s*const next = new Set\(prev\);\n\s*next\.delete\(id\);\n\s*return next;\n\s*\}\);\n\s*\}\n\s*\};\n/, '');

// 2. Change the onClick from handleManualFetch to handleFetchDetails
content = content.replace(/handleManualFetch\(order.id\)/g, 'handleFetchDetails(order.id)');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed UI component.');
