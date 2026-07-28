const fs = require('fs');

function fixInterpolation(path) {
  let file = fs.readFileSync(path, 'utf8');
  // In javascript string literal '\\${' represents '\${'
  file = file.split('\\${').join('${');
  fs.writeFileSync(path, file);
}

fixInterpolation('src/app/staff/dashboard/catalog-pricing/products/ProductListPage.tsx');
fixInterpolation('src/app/staff/dashboard/catalog-pricing/products/[id]/page.tsx');
fixInterpolation('src/app/staff/dashboard/catalog-pricing/products/create/page.tsx');

console.log('done');
