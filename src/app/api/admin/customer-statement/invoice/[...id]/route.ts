import { NextRequest, NextResponse } from 'next/server';
import { getCustomerInvoiceById } from '@/lib/zoho/customer-statement';
import { getSession } from '@/lib/auth';
import { hasMobileFeatureAccess } from '@/lib/mobile-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string | string[] }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const isDesktopAllowed = session.role === 'ADMIN' || Boolean(session.accounts_customer_statement) || Boolean(session.accountsAccess) || Boolean(session.accounts_transactions);
    const isMobileAllowed = hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_statement');
    if (!isDesktopAllowed && !isMobileAllowed) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    const rawId = Array.isArray(resolvedParams.id) ? resolvedParams.id.join('/') : resolvedParams.id;
    if (!rawId) {
      return NextResponse.json({ success: false, error: 'Invoice ID is required' }, { status: 400 });
    }

    const id = decodeURIComponent(rawId);
    const result = await getCustomerInvoiceById(id);
    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invoice: result.data,
      data: result.data,
      raw: result.raw,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
