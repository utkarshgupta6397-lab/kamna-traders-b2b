const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/api/dispatch/incoming-so/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix Total Items to use line_items.length instead of summing quantities
const oldTotalItemsLogic = `    let totalItems = 0;
    if (Array.isArray(so.line_items)) {
      totalItems = so.line_items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    }`;

const newTotalItemsLogic = `    let totalItems = 0;
    if (Array.isArray(so.line_items)) {
      // Use the number of line items (rows) as requested, not the sum of quantities
      totalItems = so.line_items.length;
    }`;

content = content.replace(oldTotalItemsLogic, newTotalItemsLogic);

// Fix total and totalTax to avoid NaN
const oldTaxLogic = `    const totalTax = so.tax_total !== undefined ? so.tax_total : (so.total_tax || 0);`;
const newTaxLogic = `    // Safe parse floats to avoid NaN in DB and UI
    let rawTax = so.tax_total !== undefined ? so.tax_total : so.total_tax;
    let totalTax = parseFloat(rawTax);
    if (isNaN(totalTax)) totalTax = 0;
    
    let parsedTotal = parseFloat(so.total);
    if (isNaN(parsedTotal)) parsedTotal = 0;`;

content = content.replace(oldTaxLogic, newTaxLogic);
content = content.replace('total: so.total,', 'total: parsedTotal,');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Route tweaked');
