import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { hasDesktopPostDispatchReviewAccess } from '@/lib/post-dispatch-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDesktopPostDispatchReviewAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 50);

  if (query.length < 2) return NextResponse.json({ skus: [] });

  try {
    // Search local master tables (Sku and ProductVariant) — NO Zoho API calls
    const [skus, variants, uoms] = await Promise.all([
      prisma.sku.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { id: { contains: query, mode: 'insensitive' } },
          ],
          isActive: true,
        },
        select: { id: true, name: true, unit: true },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.productVariant.findMany({
        where: {
          OR: [
            { sku: { contains: query, mode: 'insensitive' } },
            { variantName: { contains: query, mode: 'insensitive' } },
            { product: { name: { contains: query, mode: 'insensitive' } } },
            { product: { code: { contains: query, mode: 'insensitive' } } },
          ],
          isActive: true,
        },
        select: {
          id: true,
          sku: true,
          variantName: true,
          product: {
            select: {
              code: true,
              name: true,
              unitId: true,
            },
          },
        },
        take: limit,
      }),
      prisma.unitOfMeasurement.findMany({
        select: { id: true, abbreviation: true, name: true },
      }),
    ]);

    const uomMap = new Map(uoms.map(u => [u.id, u.abbreviation || u.name]));
    const resultMap = new Map<string, { id: string; name: string; unit: string; code: string }>();

    for (const s of skus) {
      resultMap.set(s.id, {
        id: s.id,
        name: s.name,
        unit: s.unit || 'Units',
        code: s.id,
      });
    }

    for (const v of variants) {
      if (!v.sku) continue;
      if (!resultMap.has(v.sku)) {
        const uom = (v.product.unitId && uomMap.get(v.product.unitId)) || 'Units';
        const displayName = v.variantName && v.variantName !== 'Default'
          ? `${v.product.name} (${v.variantName})`
          : v.product.name;
        resultMap.set(v.sku, {
          id: v.sku,
          name: displayName,
          unit: uom,
          code: v.product.code || v.sku,
        });
      }
    }

    const items = Array.from(resultMap.values()).slice(0, limit);

    return NextResponse.json({
      skus: items,
    });
  } catch (error) {
    console.error('[SKU Search]', error);
    return NextResponse.json({ error: 'Failed to search SKUs' }, { status: 500 });
  }
}
