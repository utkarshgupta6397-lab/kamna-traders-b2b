export function buildProductWhereClause(searchParams: URLSearchParams): any {
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'ALL';
  const createdBy = searchParams.get('createdBy') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const type = searchParams.get('type') || '';
  const itemType = searchParams.get('itemType') || 'ALL';
  const brandId = searchParams.get('brandId') || '';
  const manufacturerId = searchParams.get('manufacturerId') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const hsnCodeId = searchParams.get('hsnCodeId') || '';
  const taxRateId = searchParams.get('taxRateId') || '';
  const unitId = searchParams.get('unitId') || '';
  const incentiveTag = searchParams.get('incentiveTag') || '';
  const trackInventory = searchParams.get('trackInventory');
  const trackSerials = searchParams.get('trackSerials');

  const where: any = {};

  if (status && status !== 'ALL') {
    where.status = status;
  }
  if (type && type !== 'ALL') where.type = type;

  if (itemType !== 'ALL') {
    if (itemType === 'Standard') {
      where.catalogType = 'PRODUCT';
      where.parentProductId = null;
    } else if (itemType === 'Parents') {
      where.catalogType = 'PRODUCT_FAMILY';
    } else if (itemType === 'Variants') {
      where.parentProductId = { not: null };
    }
  }

  if (brandId && brandId !== 'ALL') where.brandId = brandId;
  if (manufacturerId && manufacturerId !== 'ALL') where.manufacturerId = manufacturerId;
  if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId;
  if (hsnCodeId && hsnCodeId !== 'ALL') where.hsnCodeId = hsnCodeId;
  if (taxRateId && taxRateId !== 'ALL') where.taxRateId = taxRateId;
  if (unitId && unitId !== 'ALL') where.unitId = unitId;
  if (incentiveTag && incentiveTag !== 'ALL') where.incentiveTag = incentiveTag;

  if (trackInventory === 'true') { where.variants = { some: { trackInventory: true } }; }
  if (trackInventory === 'false') { where.variants = { some: { trackInventory: false } }; }
  
  if (trackSerials === 'true') { 
    where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: true } }; 
  }
  if (trackSerials === 'false') { 
    where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: false } }; 
  }

  if (createdBy) {
    where.createdById = createdBy;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  if (search) {
    const tokens = search.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length > 0) {
      where.AND = tokens.map((token: string) => {
        return {
          OR: [
            { name: { contains: token, mode: 'insensitive' } },
            { code: { contains: token, mode: 'insensitive' } },
            { description: { contains: token, mode: 'insensitive' } },
            { status: { contains: token, mode: 'insensitive' } },
            { brand: { name: { contains: token, mode: 'insensitive' } } },
            { manufacturer: { name: { contains: token, mode: 'insensitive' } } },
            { category: { name: { contains: token, mode: 'insensitive' } } },
            { hsnCode: { code: { contains: token, mode: 'insensitive' } } },
            { variants: { some: { sku: { contains: token, mode: 'insensitive' } } } },
            { variantProducts: { some: { variants: { some: { sku: { contains: token, mode: 'insensitive' } } } } } },
            { variantProducts: { some: { name: { contains: token, mode: 'insensitive' } } } },
          ]
        };
      });
    }
  }

  return where;
}
