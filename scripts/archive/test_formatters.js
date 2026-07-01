// Dev formatter
function pdfFmt(n) {
  return '\u20b9' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}
// Main formatter
function fmtBalance(n) {
  if (n === 0) return '₹0.00';
  const val = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(Math.abs(n));
  return val;
}

const num = 3000000;
console.log("Raw:", num);
console.log("Main Formatter (fmtBalance):", fmtBalance(num));
console.log("Dev Formatter (pdfFmt):", pdfFmt(num));
