const fs = require('fs');
const file = 'src/components/zoho/CustomerStatementView.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const doc = new jsPDF\(\{ orientation: 'portrait'/g, "const doc = new jsPDF({ orientation: 'landscape'");

fs.writeFileSync(file, code);
