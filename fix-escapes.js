const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/lib/enrich-so.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace \` with `
content = content.replace(/\\`/g, '`');
// Replace \${ with ${
content = content.replace(/\\\$\{/g, '${');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed string escapes.');
