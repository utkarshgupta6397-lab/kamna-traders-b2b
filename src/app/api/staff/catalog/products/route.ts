import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createProductWithDefaultVariant } from '@/lib/product-service';
import { ProductAttributeService } from '@/lib/services/ProductAttributeService';
import { ProductAttributeValidationService } from '@/lib/services/ProductAttributeValidationService';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'ALL';
    const createdBy = searchParams.get('createdBy') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const type = searchParams.get('type') || '';
    const brandId = searchParams.get('brandId') || '';
    const manufacturerId = searchParams.get('manufacturerId') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const hsnCodeId = searchParams.get('hsnCodeId') || '';
    const taxRateId = searchParams.get('taxRateId') || '';
    const unitId = searchParams.get('unitId') || '';
    const incentiveTag = searchParams.get('incentiveTag') || '';
    const trackInventory = searchParams.get('trackInventory');
    const trackSerials = searchParams.get('trackSerials');
    
    const ALLOWED_SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'code', 'status', 'purchasePrice', 'sellingPrice'];
    const rawSortBy = searchParams.get('sortBy') || 'updatedAt';
    const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitParam = searchParams.get('limit') || '25';
    const limit = limitParam === 'all' ? 'all' : Math.min(100, Math.max(1, parseInt(limitParam, 10)));

    const where: any = {};

    if (status !== 'ALL') {
      where.status = status;
    }
    if (type && type !== 'ALL') where.type = type;
    if (brandId && brandId !== 'ALL') where.brandId = brandId;
    if (manufacturerId && manufacturerId !== 'ALL') where.manufacturerId = manufacturerId;
    if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId;
    if (hsnCodeId && hsnCodeId !== 'ALL') where.hsnCodeId = hsnCodeId;
    if (taxRateId && taxRateId !== 'ALL') where.taxRateId = taxRateId;
    if (unitId && unitId !== 'ALL') where.unitId = unitId;
    if (incentiveTag && incentiveTag !== 'ALL') where.incentiveTag = incentiveTag;
    
    if (trackInventory === 'true') { where.variants = { some: { trackInventory: true } }; }
    if (trackInventory === 'false') { where.variants = { some: { trackInventory: false } }; }
    if (trackSerials === 'true') { where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: true } }; }
    if (trackSerials === 'false') { where.variants = { ...where.variants, some: { ...where.variants?.some, trackSerials: false } }; }

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

    let total = 0;
    let records: any[] = [];

    if (sortBy === 'default') {
      const allRecords = await prisma.product.findMany({
        where,
        select: { id: true, status: true, updatedAt: true },
      });

      const statusWeight: Record<string, number> = {
        'Approval Pending': 1,
        'Draft': 2,
        'Active': 3,
        'Inactive': 4,
        'Archived': 5,
      };

      allRecords.sort((a: any, b: any) => {
        const weightA = statusWeight[a.status] || 99;
        const weightB = statusWeight[b.status] || 99;
        if (weightA !== weightB) return weightA - weightB;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      total = allRecords.length;
      const pagedIds = limit === 'all' 
        ? allRecords.map((r: any) => r.id) 
        : allRecords.slice((page - 1) * (limit as number), page * (limit as number)).map((r: any) => r.id);

      const rawRecords = await prisma.product.findMany({
        where: { id: { in: pagedIds } },
        include: {
          brand: { select: { id: true, name: true } },
          manufacturer: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          hsnCode: { select: { id: true, code: true, name: true } },
          taxRate: { select: { id: true, name: true, percentage: true } },
          unit: { select: { id: true, abbreviation: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          variants: true,
          variantAttribute: true,
          variantProducts: {
            include: {
              variants: true,
            },
            orderBy: { createdAt: 'asc' }
          },
          parentProduct: { select: { id: true, name: true, code: true, thumbnailBase64: true } },
        },
      });

      records = pagedIds.map((id: any) => rawRecords.find((r: any) => r.id === id)).filter(Boolean);
    } else {
      total = await prisma.product.count({ where });

      records = await prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: limit === 'all' ? undefined : (page - 1) * (limit as number),
        take: limit === 'all' ? undefined : (limit as number),
        include: {
          brand: { select: { id: true, name: true } },
          manufacturer: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          hsnCode: { select: { id: true, code: true, name: true } },
          taxRate: { select: { id: true, name: true, percentage: true } },
          unit: { select: { id: true, abbreviation: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          variants: true,
          variantAttribute: true,
          variantProducts: {
            include: {
              variants: true,
            },
            orderBy: { createdAt: 'asc' }
          },
          parentProduct: { select: { id: true, name: true, code: true, thumbnailBase64: true } },
        },
      });
    }
    
    // Normalize legacy products (e.g., default missing ProductType)
    const { LegacyProductNormalizer } = await import('@/lib/services/LegacyProductNormalizer');
    records = records.map((r: any) => LegacyProductNormalizer.normalizeProduct(r));

    return NextResponse.json({
      records,
      total,
      page,
      limit,
      totalPages: limit === 'all' ? 1 : Math.ceil(total / (limit as number)),
    });
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Permission Check
  const createPerm = 'catalog_products_create';
  if (session.role !== 'ADMIN' && !session[createPerm]) {
    return NextResponse.json({ error: `Permission Denied: ${createPerm}` }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      name, code, description, type, remarks, submitForApproval,
      brandId, manufacturerId, categoryId, hsnCodeId, taxRateId, unitId,
      purchasePrice, sellingPrice, trackInventory, trackSerials, incentiveTag, thumbnailBase64, productAttributes,
      productType, variantChildren, variantAttributeId, parentProductId
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const nameRegex = /^[a-zA-Z0-9\s/.()&+-]+$/;
    if (!nameRegex.test(name.trim())) {
      return NextResponse.json({ error: 'Product Name contains unsupported characters.' }, { status: 400 });
    }
    
    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
    }
    const skuRegex = /^[A-Z0-9]{4,20}$/;
    if (!skuRegex.test(code.trim())) {
      return NextResponse.json({ error: 'SKU must be 4-20 uppercase alphanumeric characters without spaces or symbols.' }, { status: 400 });
    }

    let resolvedBrandId = brandId;
    let resolvedManufacturerId = manufacturerId;
    let resolvedCategoryId = categoryId;
    let resolvedHsnCodeId = hsnCodeId;
    let resolvedTaxRateId = taxRateId;
    let resolvedUnitId = unitId;

    if (parentProductId) {
      const parent = await prisma.product.findUnique({ where: { id: parentProductId } });
      if (!parent || parent.catalogType !== 'PRODUCT_FAMILY') {
        return NextResponse.json({ error: 'Invalid parent product family' }, { status: 400 });
      }
      resolvedBrandId = parent.brandId;
      resolvedManufacturerId = parent.manufacturerId;
      resolvedCategoryId = parent.categoryId;
      resolvedHsnCodeId = parent.hsnCodeId;
      resolvedTaxRateId = parent.taxRateId;
      resolvedUnitId = parent.unitId;
    } else {
      if (!resolvedBrandId) return NextResponse.json({ error: 'Brand is required' }, { status: 400 });
      if (!resolvedManufacturerId) return NextResponse.json({ error: 'Manufacturer is required' }, { status: 400 });
      if (!resolvedHsnCodeId) return NextResponse.json({ error: 'HSN Code is required' }, { status: 400 });
      if (!resolvedTaxRateId) return NextResponse.json({ error: 'Tax Rate is required' }, { status: 400 });
      if (!resolvedUnitId) return NextResponse.json({ error: 'Unit of Measurement is required' }, { status: 400 });
    }

    const pPrice = parseFloat(purchasePrice) || 0;
    const sPrice = parseFloat(sellingPrice) || 0;

    if (productType !== 'variant') {
      if (pPrice <= 0) return NextResponse.json({ error: 'Purchase Price must be greater than ₹0' }, { status: 400 });
      if (sPrice <= pPrice) return NextResponse.json({ error: 'Selling Price must be greater than Purchase Price' }, { status: 400 });
    }
    
    if (code && code.trim()) {
      const existing = await prisma.product.findUnique({
        where: { code: code.trim().toUpperCase() }
      });
      if (existing) {
        return NextResponse.json({ error: `Product with code "${code.trim().toUpperCase()}" already exists` }, { status: 400 });
      }
    }

    // --- Dynamic Attribute Validation ---
    const activeAttributes = await ProductAttributeService.getAttributesForCategory(resolvedCategoryId);

    if (productType === 'single') {
      if (productAttributes && productAttributes.length > 0) {
        for (const pa of productAttributes) {
          const attrConfig = activeAttributes.find(a => a.id === pa.attributeId);
          if (!attrConfig) {
            return NextResponse.json({ error: `Invalid or inactive attribute ID: ${pa.attributeId}` }, { status: 400 });
          }
          const errorMsg = ProductAttributeValidationService.validateAttributeValue(pa.value, attrConfig);
          if (errorMsg) {
            return NextResponse.json({ error: `${attrConfig.attributeName}: ${errorMsg}` }, { status: 400 });
          }
        }
      }
      
      const missingMandatory = activeAttributes.find(attr => 
        attr.mandatory && (!productAttributes || !productAttributes.find((pa: any) => pa.attributeId === attr.id)?.value)
      );
      if (missingMandatory) {
        return NextResponse.json({ error: `Attribute "${missingMandatory.attributeName}" is required.` }, { status: 400 });
      }
    }

    let newProduct;
    if (productType === 'variant') {
      const { createVariantProductFamily } = await import('@/lib/product-service');
      
      newProduct = await createVariantProductFamily({
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : undefined,
        description: description ? description.trim() : undefined,
        type,
        brandId: resolvedBrandId,
        manufacturerId: resolvedManufacturerId,
        categoryId: resolvedCategoryId,
        hsnCodeId: resolvedHsnCodeId,
        taxRateId: resolvedTaxRateId,
        unitId: resolvedUnitId,
        remarks: remarks ? remarks.trim() : undefined,
        status: submitForApproval ? 'Approval Pending' : 'Draft',
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        trackInventory: trackInventory !== false,
        trackSerials: trackSerials === true,
        incentiveTag,
        thumbnailBase64,
        userId: session.userId,
        variantChildren
      });
    } else {
      newProduct = await createProductWithDefaultVariant({
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : undefined,
        description: description ? description.trim() : undefined,
        type,
        brandId: resolvedBrandId,
        manufacturerId: resolvedManufacturerId,
        categoryId: resolvedCategoryId,
        hsnCodeId: resolvedHsnCodeId,
        taxRateId: resolvedTaxRateId,
        unitId: resolvedUnitId,
        remarks: remarks ? remarks.trim() : undefined,
        status: submitForApproval ? 'Approval Pending' : 'Draft',
        purchasePrice: pPrice,
        sellingPrice: sPrice,
        trackInventory: trackInventory !== false,
        trackSerials: trackSerials === true,
        incentiveTag,
        thumbnailBase64,
        productAttributes,
        userId: session.userId,
        parentProductId,
      });
    }

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: any) {
    console.error(`[API] POST /api/staff/catalog/products error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}
