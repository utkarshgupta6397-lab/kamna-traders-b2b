const { jsPDF } = require('jspdf');
const fs = require('fs');

const fontRegular = fs.readFileSync('public/fonts/Inter-Regular.ttf').toString('base64');

// Test Inter
const docInter = new jsPDF();
docInter.addFileToVFS('Inter-Regular.ttf', fontRegular);
docInter.addFont('Inter-Regular.ttf', 'Inter', 'normal');
docInter.setFont('Inter', 'normal');

console.log("Inter width '₹30,39,258.50':", docInter.getStringUnitWidth('₹30,39,258.50'));
console.log("Inter width '\\u20b930,39,258.50':", docInter.getStringUnitWidth('\u20b930,39,258.50'));
console.log("Inter width 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':", docInter.getStringUnitWidth('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));

// Test NotoSans
const docNoto = new jsPDF();
docNoto.addFileToVFS('NotoSans-Regular.ttf', fontRegular);
docNoto.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
docNoto.setFont('NotoSans', 'normal');

console.log("NotoSans width '₹30,39,258.50':", docNoto.getStringUnitWidth('₹30,39,258.50'));
console.log("NotoSans width '\\u20b930,39,258.50':", docNoto.getStringUnitWidth('\u20b930,39,258.50'));
console.log("NotoSans width 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':", docNoto.getStringUnitWidth('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
