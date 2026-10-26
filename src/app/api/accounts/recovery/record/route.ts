import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RECOVERY_STATUSES } from '@/lib/recovery/recovery-calculator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const hasAccess =
      session &&
      (session.role === 'ADMIN' ||
        session.accounts_summary_view ||
        session.accounts_recovery_manage ||
        (session.mobile_accounts && session.mobile_accounts_summary_view));

    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'Missing customerId parameter' }, { status: 400 });
    }

    const record = await prisma.customerRecoveryRecord.findUnique({
      where: { customerId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: record || null,
    });
  } catch (error: any) {
    console.error('[GET /api/accounts/recovery/record]', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // Updating recovery status requires accounts_recovery_manage or ADMIN
    if (!session || (session.role !== 'ADMIN' && !session.accounts_recovery_manage)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Requires Accounts Recovery Management permission' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      customerId,
      customerName,
      status,
      nextFollowUpDate,
      internalNotes,
      assignedStaffId,
      assignedStaffName,
    } = body;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    }

    const validStatusIds = RECOVERY_STATUSES.map((s) => s.id);
    if (status && !validStatusIds.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid recovery status: ${status}` },
        { status: 400 }
      );
    }

    const userName = session.name || 'Staff';
    const userId = session.userId;
    const now = new Date();

    const parsedFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;

    // Use a transaction to ensure atomic record & activity history persistence
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerRecoveryRecord.findUnique({
        where: { customerId },
      });

      const previousStatus = existing?.status || 'PENDING_FOLLOW_UP';
      const newStatus = status || previousStatus;

      // Determine activity type and description
      const statusChanged = status && status !== previousStatus;
      const notesAdded = internalNotes && internalNotes !== existing?.internalNotes;
      const followUpChanged =
        nextFollowUpDate !== undefined &&
        (parsedFollowUpDate?.getTime() !== existing?.nextFollowUpDate?.getTime());

      let activityType = 'NOTE_ADDED';
      let description = 'Updated recovery details';

      if (statusChanged && notesAdded) {
        activityType = 'STATUS_CHANGE';
        description = `Status changed to "${newStatus}" with internal notes`;
      } else if (statusChanged) {
        activityType = 'STATUS_CHANGE';
        description = `Status changed from "${previousStatus}" to "${newStatus}"`;
      } else if (followUpChanged && parsedFollowUpDate) {
        activityType = 'FOLLOW_UP_SCHEDULED';
        description = `Follow-up scheduled for ${parsedFollowUpDate.toLocaleDateString('en-IN')}`;
      } else if (notesAdded) {
        activityType = 'NOTE_ADDED';
        description = 'Added internal recovery notes';
      }

      // Upsert CustomerRecoveryRecord
      const record = await tx.customerRecoveryRecord.upsert({
        where: { customerId },
        update: {
          status: newStatus,
          customerName: customerName || existing?.customerName || 'Unknown Customer',
          nextFollowUpDate: nextFollowUpDate !== undefined ? parsedFollowUpDate : existing?.nextFollowUpDate,
          internalNotes: internalNotes !== undefined ? internalNotes : existing?.internalNotes,
          assignedStaffId: assignedStaffId !== undefined ? assignedStaffId : existing?.assignedStaffId,
          assignedStaffName: assignedStaffName !== undefined ? assignedStaffName : existing?.assignedStaffName,
          lastActivityAt: now,
          updatedById: userId,
          updatedByName: userName,
        },
        create: {
          customerId,
          customerName: customerName || 'Unknown Customer',
          status: newStatus,
          nextFollowUpDate: parsedFollowUpDate,
          internalNotes: internalNotes || null,
          assignedStaffId: assignedStaffId || null,
          assignedStaffName: assignedStaffName || null,
          lastActivityAt: now,
          createdById: userId,
          createdByName: userName,
          updatedById: userId,
          updatedByName: userName,
        },
      });

      // Insert persistent activity history log
      await tx.customerRecoveryActivity.create({
        data: {
          recoveryRecordId: record.id,
          customerId,
          activityType,
          description,
          previousStatus: statusChanged ? previousStatus : null,
          newStatus: statusChanged ? newStatus : null,
          notes: internalNotes || null,
          performedById: userId,
          performedByName: userName,
          createdAt: now,
        },
      });

      return record;
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[POST /api/accounts/recovery/record]', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
