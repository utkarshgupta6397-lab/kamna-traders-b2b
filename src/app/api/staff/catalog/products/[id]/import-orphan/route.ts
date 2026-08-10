import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ProductAttributeService } from '@/lib/services/ProductAttributeService';
import { ProductAttributeValidationService } from '@/lib/services/ProductAttributeValidationService';
import { ProductFamilyAuditFormatter } from '@/lib/services/ProductFamilyAuditFormatter';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const modifyPerm = 'catalog_products_modify';
  if (session.role !== 'ADMIN' && !session[modifyPerm]) {
    return NextResponse.json({ error: `Permission Denied: Requires ${modifyPerm}` }, { status: 403 });
  }

  const { id: familyId } = await params;
  
  try {
    const body = await request.json();
    const { orphanProductId } = body;

    if (!orphanProductId) {
      return NextResponse.json({ error: 'Orphan product ID is required' }, { status: 400 });
    }

    // 1. Fetch Family
    const family = await prisma.product.findUnique({
      where: { id: familyId },
      include: {
        variantProducts: {
          where: { isActive: true },
          include: { attributeValues: true }
        }
      }
    });

    if (!family || family.catalogType !== 'PRODUCT_FAMILY') {
      return NextResponse.json({ error: 'Target is not a valid Product Family' }, { status: 400 });
    }

    // 2. Fetch Orphan
    const orphan = await prisma.product.findUnique({
      where: { id: orphanProductId },
      include: {
        variants: true,
        attributeValues: true
      }
    });

    const validationPassed: string[] = [];
    const validationFailed: string[] = [];

    // Helper to log check
    const check = (condition: boolean, passMsg: string, failMsg: string) => {
      if (condition) {
        validationPassed.push(passMsg);
      } else {
        validationFailed.push(failMsg);
      }
    };

    // 3. Mandatory Business Validation
    if (!orphan) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    check(orphan.status === 'Active', 'Product is Active', 'Product is no longer active.');
    check(!orphan.parentProductId, 'Product is not already assigned', 'Product already belongs to another Product Family.');
    check(orphan.catalogType !== 'PRODUCT_FAMILY' && !orphan.isVariantProduct, 'Product is Standalone', 'Product is itself a Product Family or already a variant.');
    check(orphan.variants.length <= 1, 'Product has no child variants', 'Product contains child variants and cannot be imported.');

    // 4. Strict Field Validation
    check(orphan.categoryId === family.categoryId, 'Category matches', 'Category does not match the selected family.');
    check(orphan.brandId === family.brandId, 'Brand matches', 'Brand does not match the selected family.');
    check(orphan.manufacturerId === family.manufacturerId, 'Manufacturer matches', 'Manufacturer does not match the selected family.');
    check(orphan.hsnCodeId === family.hsnCodeId, 'HSN matches', 'HSN does not match the selected family.');
    check(orphan.taxRateId === family.taxRateId, 'Tax configuration matches', 'Tax configuration does not match the selected family.');
    check(orphan.unitId === family.unitId, 'Unit of measurement matches', 'Unit of measurement does not match the selected family.');
    check(orphan.type === family.type, 'Product Type matches', 'Product Type does not match the selected family.');

    // 5. Attribute Validation
    if (family.categoryId) {
      const activeAttributes = await ProductAttributeService.getAttributesForCategory(family.categoryId);
      
      // Check for missing mandatory attributes
      for (const attr of activeAttributes) {
        if (attr.mandatory) {
          const hasAttr = orphan.attributeValues.some(av => av.attributeId === attr.id && av.value && av.value.trim() !== '');
          if (!hasAttr) {
            validationFailed.push(`Missing mandatory attribute: ${attr.attributeName}`);
          } else {
             // Optional: validationPassed.push(`Attribute ${attr.attributeName} is present`);
          }
        }
      }

      // Check for valid values
      for (const av of orphan.attributeValues) {
        const attrConfig = activeAttributes.find(a => a.id === av.attributeId);
        if (attrConfig) {
          const errorMsg = ProductAttributeValidationService.validateAttributeValue(av.value, attrConfig);
          if (errorMsg) {
            validationFailed.push(`Invalid value for attribute '${attrConfig.attributeName}'`);
          }
        }
      }
    }

    // 6. Duplicate Variant Validation (Exact Attribute Match)
    const orphanAttrMap = new Map(orphan.attributeValues.map(av => [av.attributeId, av.value]));
    let duplicateFound = false;
    for (const child of family.variantProducts) {
      if (child.id === orphan.id) continue;
      if (child.attributeValues.length !== orphan.attributeValues.length) continue;
      
      let isExactMatch = true;
      for (const cav of child.attributeValues) {
        if (orphanAttrMap.get(cav.attributeId) !== cav.value) {
          isExactMatch = false;
          break;
        }
      }

      if (isExactMatch && child.attributeValues.length > 0) {
        duplicateFound = true;
        break;
      }
    }
    
    check(!duplicateFound, 'Attribute combination is unique', 'Duplicate variant already exists with same attribute combination.');

    if (validationFailed.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Validation failed', 
        validationPassed, 
        validationFailed 
      }, { status: 400 });
    }

    // 7. Transactional Update
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: orphan.id },
        data: {
          parentProductId: family.id,
          isVariantProduct: true,
          thumbnailBase64: family.thumbnailBase64,
          updatedById: session.userId,
        }
      });

      await tx.masterDataHistory.create({
        data: {
          entityType: 'Product',
          entityId: family.id,
          action: 'Imported Into Product Family',
          previousValue: null,
          newValue: ProductFamilyAuditFormatter.formatVariantImported(orphan, family),
          remarks: `Imported standalone product ${orphan.code} into family ${family.code}`,
          performedById: session.userId,
          productId: family.id,
        }
      });
      
      await tx.masterDataHistory.create({
        data: {
          entityType: 'Product',
          entityId: orphan.id,
          action: 'Imported Into Product Family',
          previousValue: null,
          newValue: ProductFamilyAuditFormatter.formatVariantImported(orphan, family),
          remarks: `Product converted to variant and attached to family ${family.code}`,
          performedById: session.userId,
          productId: orphan.id,
        }
      });
    });

    return NextResponse.json({ success: true, message: 'Product successfully imported into Product Family.' });
  } catch (error: any) {
    console.error('[ImportOrphan] Error:', error);
    return NextResponse.json({ error: 'Internal server error processing import' }, { status: 500 });
  }
}
