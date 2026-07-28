const fs = require('fs');

const routePath = 'src/app/api/staff/catalog/products/route.ts';
let route = fs.readFileSync(routePath, 'utf8');

const oldVars = `    const dateTo = searchParams.get('dateTo') || '';
    const ALLOWED_SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'code', 'status'];`;
    
const newVars = `    const dateTo = searchParams.get('dateTo') || '';
    const type = searchParams.get('type') || '';
    const brandId = searchParams.get('brandId') || '';
    const manufacturerId = searchParams.get('manufacturerId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const hsnCodeId = searchParams.get('hsnCodeId') || '';
    const incentiveTag = searchParams.get('incentiveTag') || '';
    const trackInventory = searchParams.get('trackInventory');
    const trackSerials = searchParams.get('trackSerials');
    
    const ALLOWED_SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'code', 'status', 'purchasePrice', 'sellingPrice'];`;

route = route.replace(oldVars, newVars);

const oldWhere = `    const where: any = {};

    if (status !== 'ALL') {
      where.status = status;
    }

    if (createdBy) {
      where.createdById = createdBy;
    }`;

const newWhere = `    const where: any = {};

    if (status !== 'ALL') {
      where.status = status;
    }
    if (type && type !== 'ALL') where.type = type;
    if (brandId && brandId !== 'ALL') where.brandId = brandId;
    if (manufacturerId && manufacturerId !== 'ALL') where.manufacturerId = manufacturerId;
    if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId;
    if (hsnCodeId && hsnCodeId !== 'ALL') where.hsnCodeId = hsnCodeId;
    if (incentiveTag && incentiveTag !== 'ALL') where.incentiveTag = incentiveTag;
    
    if (trackInventory === 'true') where.trackInventory = true;
    if (trackInventory === 'false') where.trackInventory = false;
    if (trackSerials === 'true') where.trackSerials = true;
    if (trackSerials === 'false') where.trackSerials = false;

    if (createdBy) {
      where.createdById = createdBy;
    }`;

route = route.replace(oldWhere, newWhere);

fs.writeFileSync(routePath, route);
console.log('done');
