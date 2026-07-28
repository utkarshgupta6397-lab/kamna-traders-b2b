const fs = require('fs');
const path = 'src/app/api/staff/catalog/products/[id]/route.ts';

let content = fs.readFileSync(path, 'utf8');

const putMethod = `
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
      thumbnailBase64,
    } = data;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: true }
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        type, name, description, remarks, incentiveTag, thumbnailBase64,
        brand: brandId ? { connect: { id: brandId } } : undefined,
        manufacturer: manufacturerId ? { connect: { id: manufacturerId } } : undefined,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        hsnCode: hsnCodeId ? { connect: { id: hsnCodeId } } : undefined,
        taxRate: taxRateId ? { connect: { id: taxRateId } } : undefined,
        unit: unitId ? { connect: { id: unitId } } : undefined,
        updatedBy: { connect: { id: session.userId } },
        variants: {
          update: {
            where: { id: existingProduct.variants[0].id },
            data: {
              sku: code,
              name,
              purchasePrice: parseFloat(purchasePrice),
              sellingPrice: parseFloat(sellingPrice),
              trackInventory,
              trackSerials,
            }
          }
        }
      }
    });

    // Handle code separately as it requires sequence update logic if changed, but we assume code (SKU) might just be updated in DB safely since it's unique
    if (code !== existingProduct.code) {
      await prisma.product.update({ where: { id }, data: { code } });
    }

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error('[API] PUT /api/staff/catalog/products/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
  }
}
`;

content += putMethod;
fs.writeFileSync(path, content);
console.log('done');
