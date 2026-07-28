import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const session = await getSession();
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { categoryId } = await params;

  try {
    // We want to fetch attributes mapped to this category.
    // In a complex hierarchy, it might inherit from parent. The prompt says:
    // "Do not introduce inheritance in MVP."
    // So we just fetch attributes directly mapped to this categoryId.
    const mappedAttributes = await prisma.productAttributeCategory.findMany({
      where: { categoryId },
      include: {
        attribute: true
      }
    });

    // We only want active attributes to appear in Product Create/Edit
    const activeAttributes = mappedAttributes
      .map(m => m.attribute)
      .filter(attr => attr.status === 'Active');

    return NextResponse.json(activeAttributes);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/categories/${categoryId}/attributes error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
