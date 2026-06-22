import { NextRequest, NextResponse } from 'next/server';
import { getVendorBillById } from '@/lib/zoho/customer-statement';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Bill ID is required' }, { status: 400 });
    }

    const result = await getVendorBillById(id);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
