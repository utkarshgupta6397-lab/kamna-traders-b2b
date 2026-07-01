const { jsPDF } = require('jspdf');
const fs = require('fs');

const doc = new jsPDF();
const fontRegular = fs.readFileSync('public/fonts/Inter-Regular.ttf').toString('base64');
doc.addFileToVFS('Inter-Regular.ttf', fontRegular);
doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');

const fonts = doc.getFontList();
console.log("Font List after adding 'Inter':", JSON.stringify(fonts, null, 2));
console.log("Is 'Inter' in Font List?", !!fonts['Inter']);
console.log("Is 'NotoSans' in Font List?", !!fonts['NotoSans']);
