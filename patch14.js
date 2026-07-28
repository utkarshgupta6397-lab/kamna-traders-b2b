const fs = require('fs');

// Fix GET route.ts
const routePath = 'src/app/api/staff/catalog/products/route.ts';
let route = fs.readFileSync(routePath, 'utf8');
route = route.replace(`    if (trackInventory === 'true') where.trackInventory = true;
    if (trackInventory === 'false') where.trackInventory = false;
    if (trackSerials === 'true') where.trackSerials = true;
    if (trackSerials === 'false') where.trackSerials = false;`, 
`    if (trackInventory === 'true') { where.variants = { some: { trackInventory: true } }; }
    if (trackInventory === 'false') { where.variants = { some: { trackInventory: false } }; }
    if (trackSerials === 'true') { where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: true } }; }
    if (trackSerials === 'false') { where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: false } }; }`);
fs.writeFileSync(routePath, route);

// Fix GET stats/route.ts
const statsPath = 'src/app/api/staff/catalog/products/stats/route.ts';
let stats = fs.readFileSync(statsPath, 'utf8');
stats = stats.replace(
`      prisma.product.count({ where: { trackInventory: true } }),
      prisma.product.count({ where: { trackSerials: true } }),`,
`      prisma.product.count({ where: { variants: { some: { trackInventory: true } } } }),
      prisma.product.count({ where: { variants: { some: { trackSerials: true } } } }),`
);
fs.writeFileSync(statsPath, stats);

console.log('done');
