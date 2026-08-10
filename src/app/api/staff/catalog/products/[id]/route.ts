import { NextResponse, NextRequest, after } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMasterAuditLog } from '@/lib/master-data-service';
import { ProductAttributeService } from '@/lib/services/ProductAttributeService';
import { ProductAttributeValidationService } from '@/lib/services/ProductAttributeValidationService';
import { CatalogResolver } from '@/lib/services/CatalogResolver';
import { CategoryService } from '@/lib/services/CategoryService';
import { ZohoProductService } from '@/lib/services/zoho-books';
import { getZohoTokens } from '@/lib/zoho-auth';
import { AuditPayloadBuilder } from '@/lib/services/audit-payload-builder';
import { SharedAttributeCascadeService } from '@/lib/services/SharedAttributeCascadeService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        manufacturer: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        hsnCode: { select: { id: true, code: true, name: true } },
        taxRate: { select: { id: true, name: true, percentage: true } },
        unit: { select: { id: true, abbreviation: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        variants: true,
        attributeValues: {
          include: { attribute: true }
        },
        variantProducts: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            type: true,
            brandId: true,
            manufacturerId: true,
            categoryId: true,
            hsnCodeId: true,
            taxRateId: true,
            unitId: true,
            status: true,
            isActive: true,
            incentiveTag: true,
            catalogType: true,
            isVariantProduct: true,
            parentProductId: true,
            variantAttributeId: true,
            variantAttributeValue: true,
            createdAt: true,
            updatedAt: true,
            variants: true,
            attributeValues: {
              include: { attribute: true }
            }
          }
        },
        parentProduct: true,
        history: {
          take: 50,
          orderBy: { performedAt: 'desc' },
          include: { performedBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/products/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.product.findUnique({ 
      where: { id },
      include: {
        brand: true, category: true, manufacturer: true, hsnCode: true, taxRate: true, unit: true,
        variants: true,
      }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Permission check
    const modifyPerm = 'catalog_products_modify';
    const createPerm = 'catalog_products_create';
    const hasModify = session.role === 'ADMIN' || session[modifyPerm];
    const hasCreate = session.role === 'ADMIN' || session[createPerm];

    if (!hasModify) {
      if (!(hasCreate && existing.status === 'Draft' && existing.createdById === session.userId)) {
        return NextResponse.json({ error: `Permission Denied: Requires ${modifyPerm} or owner Create access for Drafts` }, { status: 403 });
      }
    }

    if (existing.status === 'Archived') {
      return NextResponse.json({ error: 'Archived products cannot be modified' }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, remarks, brandId, manufacturerId, categoryId, hsnCodeId, taxRateId, unitId, thumbnailBase64, status } = body;

    const updateData: any = {
      updatedBy: { connect: { id: session.userId } },
    };

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.product.findFirst({
        where: { name: { equals: name.trim(), mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: `Product with name "${name}" already exists` }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) {
      const parsedCode = code ? code.trim().toUpperCase() : null;
      if (parsedCode && parsedCode !== existing.code) {
        const existingCode = await prisma.product.findFirst({
          where: { code: { equals: parsedCode, mode: 'insensitive' }, id: { not: id } },
        });
        if (existingCode) {
          return NextResponse.json({ error: `Product with code "${parsedCode}" already exists` }, { status: 400 });
        }
      }
      updateData.code = parsedCode;
    }

    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (remarks !== undefined) updateData.remarks = remarks ? remarks.trim() : null;
    if (thumbnailBase64 !== undefined) updateData.thumbnailBase64 = thumbnailBase64;
    if (status !== undefined) updateData.status = status;

    if (brandId !== undefined) {
      if (brandId) updateData.brand = { connect: { id: brandId } };
      else updateData.brand = { disconnect: true };
    }
    if (manufacturerId !== undefined) {
      if (manufacturerId) updateData.manufacturer = { connect: { id: manufacturerId } };
      else updateData.manufacturer = { disconnect: true };
    }
    if (categoryId !== undefined) {
      if (categoryId) updateData.category = { connect: { id: categoryId } };
      else updateData.category = { disconnect: true };
    }
    if (hsnCodeId !== undefined) {
      if (hsnCodeId) updateData.hsnCode = { connect: { id: hsnCodeId } };
      else updateData.hsnCode = { disconnect: true };
    }
    if (taxRateId !== undefined) {
      if (taxRateId) updateData.taxRate = { connect: { id: taxRateId } };
      else updateData.taxRate = { disconnect: true };
    }
    if (unitId !== undefined) {
      if (unitId) updateData.unit = { connect: { id: unitId } };
      else updateData.unit = { disconnect: true };
    }

    const updatedRecord = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        updatedBy: { select: { id: true, name: true } },
        brand: true, category: true, manufacturer: true, hsnCode: true, taxRate: true, unit: true,
        variants: true,
      },
    });

    const flatExisting = AuditPayloadBuilder.build({
      ...existing,
      purchasePrice: existing.variants?.[0]?.purchasePrice,
      sellingPrice: existing.variants?.[0]?.sellingPrice,
      trackInventory: existing.variants?.[0]?.trackInventory,
      trackSerials: existing.variants?.[0]?.trackSerials,
    });
    
    const flatUpdated = AuditPayloadBuilder.build({
      ...updatedRecord,
      purchasePrice: updatedRecord.variants?.[0]?.purchasePrice,
      sellingPrice: updatedRecord.variants?.[0]?.sellingPrice,
      trackInventory: updatedRecord.variants?.[0]?.trackInventory,
      trackSerials: updatedRecord.variants?.[0]?.trackSerials,
    });

    // Write audit log
    await createMasterAuditLog({
      entityType: 'Product',
      entityId: id,
      action: 'UPDATED',
      previousValue: JSON.stringify(flatExisting),
      newValue: JSON.stringify(flatUpdated),
      remarks: remarks || 'Product updated',
      userId: session.userId,
      productId: id, // Connect FK
    } as any);

    let zohoSyncError = null;

    if (existing.catalogType === 'PRODUCT_FAMILY') {
      await SharedAttributeCascadeService.cascadeUpdates(id, existing, updatedRecord, session);
    } else {
      // Zoho Books Sync Trigger for Status Change
      if (existing.status !== updatedRecord.status && (updatedRecord.status === 'Active' || updatedRecord.status === 'Inactive')) {
        try {
          await Promise.all(updatedRecord.variants.map(async (v: any) => {
            if (v.zohoBookItemId) {
              await ZohoProductService.syncVariant(v.id, 'AUTO_SAVE');
            }
          }));
        } catch (err: any) {
          console.error('[ZohoStatusSync] Sync error', err);
          zohoSyncError = err.message || 'Failed to sync status to Zoho Books';
        }
      }

      // Image Sync hook
      if (thumbnailBase64 !== undefined) {
        const defaultVariant = await prisma.productVariant.findFirst({ where: { productId: id, isDefault: true } });
        if (defaultVariant?.zohoBookItemId) {
          const accessToken = await getZohoTokens();
          if (accessToken) {
            after(() => {
              ZohoProductService.uploadImage(defaultVariant.id, defaultVariant.zohoBookItemId!, accessToken, true).catch(err => {
                console.error('[ZohoImageSync] Image sync error:', err);
              });
            });
          }
        }
      }
    }

    return NextResponse.json({ ...updatedRecord, zohoSyncError });
  } catch (error: any) {
    console.error(`[API] PATCH /api/staff/catalog/products/${id} error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const data = await request.json();
    const {
      type, name, code, description, remarks,
      brandId, manufacturerId, categoryId,
      hsnCodeId, taxRateId, unitId,
      purchasePrice, sellingPrice,
      trackInventory, trackSerials, incentiveTag,
      thumbnailBase64, productAttributes
    } = data;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: true, variantProducts: true }
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (name && name.trim() !== existingProduct.name) {
      const duplicate = await prisma.product.findFirst({
        where: { name: { equals: name.trim(), mode: 'insensitive' }, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: `Product with name "${name}" already exists` }, { status: 400 });
      }
    }

    if (code) {
      const parsedCode = code.trim().toUpperCase();
      if (parsedCode !== existingProduct.code) {
        const existingCode = await prisma.product.findFirst({
          where: { code: { equals: parsedCode, mode: 'insensitive' }, id: { not: id } },
        });
        if (existingCode) {
          return NextResponse.json({ error: `Product with code "${parsedCode}" already exists` }, { status: 400 });
        }
      }
    }

    if (incentiveTag) {
      const allowedTags = ['High-Margin Product', 'Medium-Margin Product', 'Low-Margin Product'];
      if (!allowedTags.includes(incentiveTag)) {
        return NextResponse.json({ error: `Invalid Incentive Category: "${incentiveTag}". Allowed values are: ${allowedTags.join(', ')}` }, { status: 400 });
      }
    }

    if (!existingProduct.parentProductId && categoryId) {
      const isLeaf = await CategoryService.isLeafCategory(categoryId);
      if (!isLeaf) {
        return NextResponse.json({ error: 'Products can only be assigned to leaf categories (categories with no sub-categories).' }, { status: 400 });
      }
    }

    // --- Dynamic Attribute Validation ---
    if (existingProduct.catalogType !== 'PRODUCT_FAMILY') {
      if (productAttributes && productAttributes.length > 0) {
        const activeAttributes = await ProductAttributeService.getAttributesForCategory(categoryId || existingProduct.categoryId);
        
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

        // Check for missing mandatory attributes
        const missingMandatory = activeAttributes.find(attr => 
          attr.mandatory && !productAttributes.find((pa: any) => pa.attributeId === attr.id)?.value
        );
        if (missingMandatory) {
          return NextResponse.json({ error: `Attribute "${missingMandatory.attributeName}" is required.` }, { status: 400 });
        }
      } else {
        // Check if there are mandatory attributes but none were provided
        const activeAttributes = await ProductAttributeService.getAttributesForCategory(categoryId || existingProduct.categoryId);
        const missingMandatory = activeAttributes.find(attr => attr.mandatory);
        if (missingMandatory) {
          return NextResponse.json({ error: `Attribute "${missingMandatory.attributeName}" is required.` }, { status: 400 });
        }
      }
    }

    const updateData: any = {
      name, description, remarks, incentiveTag, thumbnailBase64,
      brand: brandId ? { connect: { id: brandId } } : undefined,
      manufacturer: manufacturerId ? { connect: { id: manufacturerId } } : undefined,
      category: categoryId ? { connect: { id: categoryId } } : undefined,
      hsnCode: hsnCodeId ? { connect: { id: hsnCodeId } } : undefined,
      taxRate: taxRateId ? { connect: { id: taxRateId } } : undefined,
      unit: unitId ? { connect: { id: unitId } } : undefined,
      updatedBy: { connect: { id: session.userId } },
      ...(productAttributes ? {
        attributeValues: {
          deleteMany: {},
          create: productAttributes.map((attr: any) => ({
            attributeId: attr.attributeId,
            value: attr.value
          }))
        }
      } : {})
    };

    if (existingProduct.catalogType !== 'PRODUCT_FAMILY' && existingProduct.variants && existingProduct.variants.length > 0) {
      updateData.variants = {
        update: {
          where: { id: existingProduct.variants[0].id },
          data: {
            sku: code,
            purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : undefined,
            sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : undefined,
            trackInventory,
            trackSerials,
          }
        }
      };
    }

    const txOps = [prisma.product.update({ where: { id }, data: updateData })];

    const txResults = await prisma.$transaction(txOps);
    const updatedProduct = txResults[0];

    // Handle code separately as it requires sequence update logic if changed, but we assume code (SKU) might just be updated in DB safely since it's unique
    if (code !== existingProduct.code) {
      await prisma.product.update({ where: { id }, data: { code } });
    }

    if (existingProduct.catalogType === 'PRODUCT_FAMILY') {
      await SharedAttributeCascadeService.cascadeUpdates(id, existingProduct, updatedProduct, session);
    }

    const existingForAudit = {
      ...existingProduct,
      sku: existingProduct.variants?.[0]?.sku,
      purchasePrice: existingProduct.variants?.[0]?.purchasePrice,
      sellingPrice: existingProduct.variants?.[0]?.sellingPrice,
      trackInventory: existingProduct.variants?.[0]?.trackInventory,
      trackSerials: existingProduct.variants?.[0]?.trackSerials,
    };

    const newForAudit = {
      ...updatedProduct,
      sku: code,
      purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : undefined,
      sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : undefined,
      trackInventory,
      trackSerials,
    };

    await createMasterAuditLog({
      entityType: 'Product',
      entityId: id,
      action: 'UPDATED',
      previousValue: JSON.stringify(existingForAudit),
      newValue: JSON.stringify(newForAudit),
      remarks: remarks || 'Product updated',
      userId: session.userId,
      productId: id,
    } as any);

    CatalogResolver.invalidateCache();
    
    const defaultVariant = existingProduct.variants?.[0];
    if (defaultVariant?.id) {
      after(() => {
        ZohoProductService.syncVariant(defaultVariant.id, 'AUTO_SAVE').catch(err => {
          console.error('[ZohoProductSync] Auto-sync error:', err);
        });
      });
    }

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error('[API] PUT /api/staff/catalog/products/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
  }
}
