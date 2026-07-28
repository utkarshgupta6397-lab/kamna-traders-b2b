import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function getRandomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const maxRetries = 20;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const candidate = getRandomString(6);

    // Check uniqueness against ProductVariant (sku) AND Product (code)
    const existingVariant = await prisma.productVariant.findFirst({
      where: {
        OR: [
          { sku: candidate },
          { sku: `${candidate}-V1` }
        ]
      }
    });

    const existingProduct = await prisma.product.findUnique({
      where: { code: candidate }
    });

    if (!existingVariant && !existingProduct) {
      return NextResponse.json({ sku: candidate });
    }
  }

  return NextResponse.json(
    { error: 'Unable to generate unique SKU after 20 attempts. Please try again.' },
    { status: 500 }
  );
}
