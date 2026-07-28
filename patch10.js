const fs = require('fs');

const routePath = 'src/app/api/staff/catalog/products/route.ts';
let route = fs.readFileSync(routePath, 'utf8');
route = route.replace(/const nameRegex = \/\^\[a-zA-Z0-9\\\\s\\\\-\/\\\\.\\\\\\(\\\\\\)\\\\&\\+\]\+\$\/;/g, 'const nameRegex = /^[a-zA-Z0-9\\s/.()&+-]+$/;');
fs.writeFileSync(routePath, route);

const pagePath = 'src/app/staff/dashboard/catalog-pricing/products/create/page.tsx';
let page = fs.readFileSync(pagePath, 'utf8');
// The regex in page might be slightly differently formatted or identical
page = page.replace(/\/\^\[a-zA-Z0-9\\\\s\\\\-\/\\\\.\\\\\\(\\\\\\)\\\\&\\+\]\+\$\//g, '/^[a-zA-Z0-9\\s/.()&+-]+$/');
fs.writeFileSync(pagePath, page);

console.log('done');
