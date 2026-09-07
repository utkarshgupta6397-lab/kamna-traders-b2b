const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'next.config.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace conflict markers with the stashed changes (which includes cloudflare tunnel)
content = content.replace(/<<<<<<< Updated upstream[\s\S]*?=======\n/g, '');
content = content.replace(/>>>>>>> Stashed changes\n/g, '');

fs.writeFileSync(file, content);
console.log('Conflict resolved.');
