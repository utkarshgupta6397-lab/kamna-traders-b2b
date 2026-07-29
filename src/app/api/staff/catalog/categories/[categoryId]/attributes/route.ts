import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ProductAttributeService } from '@/lib/services/ProductAttributeService';

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
    const { searchParams } = new URL(request.url);
    const subcategoryId = searchParams.get('subcategoryId');

    const attributes = await ProductAttributeService.getAttributesForCategory(categoryId, subcategoryId);

    return NextResponse.json(attributes);
  } catch (error: any) {
    console.error(`[API] GET /api/staff/catalog/categories/${categoryId}/attributes error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
