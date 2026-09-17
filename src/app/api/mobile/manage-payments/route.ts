import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasMobilePermission } from '@/lib/mobile-auth';
import {
  generatePaymentRequestNumber,
  getTodayDateStringIST,
  getAllowedPaymentDateRangeIST,
} from '@/lib/manage-payments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canViewOwn =
      hasMobilePermission(session, 'manage_payments_view_own') ||
      hasMobilePermission(session, 'manage_payments_view_all') ||
      session.role === 'ADMIN';

    if (!canViewOwn) {
      return NextResponse.json(
        { error: 'You do not have permission to view payments.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'my';
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').trim();
    const dateRange = searchParams.get('dateRange');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const paymentMode = searchParams.get('paymentMode');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const canViewAll =
      hasMobilePermission(session, 'manage_payments_view_all') ||
      session.role === 'ADMIN';

    if (view === 'all' && !canViewAll) {
      return NextResponse.json(
        { error: 'You do not have permission to view all payments.' },
        { status: 403 }
      );
    }

    const where: any = {};

    if (view === 'my') {
      where.createdById = session.userId;
    }

    if (status !== 'all') {
      where.status = status;
    }

    if (paymentMode && paymentMode !== 'all') {
      where.paymentMode = paymentMode;
    }

    if (search) {
      where.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerId: { contains: search, mode: 'insensitive' } },
        { createdBy: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (dateRange && dateRange !== 'all') {
      const todayStr = getTodayDateStringIST();
      const [year, month, day] = todayStr.split('-').map(Number);

      let fromDateStr = todayStr;
      let toDateStr = todayStr;

      if (dateRange === 'today') {
        fromDateStr = todayStr;
        toDateStr = todayStr;
      } else if (dateRange === 'yesterday') {
        const yDate = new Date(Date.UTC(year, month - 1, day - 1));
        fromDateStr = yDate.toISOString().slice(0, 10);
        toDateStr = fromDateStr;
      } else if (dateRange === '3days' || dateRange === '3D') {
        const d = new Date(Date.UTC(year, month - 1, day - 2));
        fromDateStr = d.toISOString().slice(0, 10);
        toDateStr = todayStr;
      } else if (dateRange === '7days' || dateRange === '7D') {
        const d = new Date(Date.UTC(year, month - 1, day - 6));
        fromDateStr = d.toISOString().slice(0, 10);
        toDateStr = todayStr;
      } else if (dateRange === '15days' || dateRange === '15D') {
        const d = new Date(Date.UTC(year, month - 1, day - 14));
        fromDateStr = d.toISOString().slice(0, 10);
        toDateStr = todayStr;
      } else if (dateRange === 'custom' && startDate && endDate) {
        fromDateStr = startDate;
        toDateStr = endDate;
      }

      if (fromDateStr && toDateStr) {
        where.paymentDate = {
          gte: new Date(`${fromDateStr}T00:00:00.000Z`),
          lte: new Date(`${toDateStr}T23:59:59.999Z`),
        };
      }
    }

    const [payments, total] = await Promise.all([
      prisma.paymentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: {
            select: { id: true, name: true, gstNumber: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          approvedBy: {
            select: { id: true, name: true },
          },
          rejectedBy: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.paymentRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      payments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (error: any) {
    console.error('[Manage Payments List API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const canCreate =
      hasMobilePermission(session, 'manage_payments_create') ||
      session.role === 'ADMIN';

    if (!canCreate) {
      return NextResponse.json(
        { error: 'You do not have permission to record payments.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { customerId, amount, paymentDate, paymentMode, photoUrl, idempotencyKey } = body;

    // 1. Idempotency Key Validation
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'Idempotency key is required for payment submission.' },
        { status: 400 }
      );
    }

    const cleanIdempotencyKey = idempotencyKey.trim();

    // Check if request with this idempotency key was already processed
    const existing = await prisma.paymentRequest.findUnique({
      where: { idempotencyKey: cleanIdempotencyKey },
      include: {
        customer: { select: { id: true, name: true, gstNumber: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        payment: existing,
        isDuplicate: true,
        message: 'Payment request already submitted.',
      });
    }

    // 2. Customer Validation
    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'Customer is required.' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Selected customer was not found.' }, { status: 400 });
    }

    // 3. Amount Validation (Required, > 0, <= 200,000)
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: 'Enter a payment amount greater than ₹0.' },
        { status: 400 }
      );
    }
    if (numAmount > 200000) {
      return NextResponse.json(
        { error: 'Maximum payment amount is ₹2,00,000.' },
        { status: 400 }
      );
    }

    // 4. Payment Date Validation (Today or past in IST, max 15 calendar days ago)
    const { minDate, maxDate } = getAllowedPaymentDateRangeIST();
    if (!paymentDate || typeof paymentDate !== 'string') {
      return NextResponse.json({ error: 'Payment date is required.' }, { status: 400 });
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(paymentDate)) {
      return NextResponse.json({ error: 'Payment date format must be YYYY-MM-DD.' }, { status: 400 });
    }

    if (paymentDate > maxDate) {
      return NextResponse.json(
        { error: 'Future dates are not allowed. Please select today or an earlier date.' },
        { status: 400 }
      );
    }

    if (paymentDate < minDate) {
      return NextResponse.json(
        { error: 'Payments older than 15 days cannot be recorded. Please select another date.' },
        { status: 400 }
      );
    }

    // 5. Payment Mode Validation
    if (paymentMode !== 'POS') {
      return NextResponse.json(
        { error: 'Only POS payment mode is supported in Phase 1.' },
        { status: 400 }
      );
    }

    // 6. Photo Proof Validation (Mandatory for POS)
    if (paymentMode === 'POS') {
      if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.trim()) {
        return NextResponse.json(
          { error: 'Receipt / slip photo is mandatory for POS payments.' },
          { status: 400 }
        );
      }
    }

    // 6. Request Number Generation
    const requestNumber = await generatePaymentRequestNumber();

    // 7. Create Payment Request
    try {
      const payment = await prisma.paymentRequest.create({
        data: {
          requestNumber,
          customerId: customer.id,
          customerName: customer.name,
          amount: numAmount,
          paymentDate: new Date(`${paymentDate}T00:00:00.000Z`),
          paymentMode: 'POS',
          photoUrl: photoUrl && typeof photoUrl === 'string' ? photoUrl.trim() : null,
          status: 'PENDING_APPROVAL',
          idempotencyKey: cleanIdempotencyKey,
          createdById: session.userId,
        },
        include: {
          customer: { select: { id: true, name: true, gstNumber: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        payment,
      });
    } catch (err: any) {
      // Catch concurrent duplicate submission attempt on unique idempotencyKey
      if (err.code === 'P2002' && err.meta?.target?.includes('idempotencyKey')) {
        const concurrentExisting = await prisma.paymentRequest.findUnique({
          where: { idempotencyKey: cleanIdempotencyKey },
          include: {
            customer: { select: { id: true, name: true, gstNumber: true } },
            createdBy: { select: { id: true, name: true } },
          },
        });
        if (concurrentExisting) {
          return NextResponse.json({
            success: true,
            payment: concurrentExisting,
            isDuplicate: true,
          });
        }
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[Manage Payments Create API Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create payment request' },
      { status: 500 }
    );
  }
}
