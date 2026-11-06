import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  isValidCallPriority,
  normalizeCallPriority,
  CallPriorityKey,
} from '@/lib/recovery/call-priority';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  return handleUpdateCallPriority(request);
}

export async function POST(request: Request) {
  return handleUpdateCallPriority(request);
}

async function handleUpdateCallPriority(request: Request) {
  try {
    const session = await getSession();
    const hasAccess =
      session &&
      (session.role === 'ADMIN' ||
        session.accounts_summary_view ||
        session.accounts_recovery_manage ||
        (session.mobile_accounts && session.mobile_accounts_summary_view));

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Requires Accounts Access' },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON payload' },
        { status: 400 }
      );
    }

    const { customerId, callPriority, customerName } = body || {};

    if (!customerId || typeof customerId !== 'string' || !customerId.trim()) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing customerId' },
        { status: 400 }
      );
    }

    if (!callPriority || !isValidCallPriority(callPriority)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid callPriority value. Permitted values: CALL_IMMEDIATELY, VERIFY_FIRST, SENIOR_FOLLOWUP, NO_CALL_NEEDED',
        },
        { status: 400 }
      );
    }

    const trimmedId = customerId.trim();
    const normalizedPriority = normalizeCallPriority(callPriority);
    const sanitizedName =
      customerName && typeof customerName === 'string' && customerName.trim()
        ? customerName.trim()
        : 'Customer';
    const now = new Date();
    const staffId = session.userId || null;

    // Persist call priority in canonical Customer entity
    let updated: { id: string; callPriority: string; name: string };

    const ensureColumns = async () => {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "callPriority" TEXT NOT NULL DEFAULT 'NO_CALL_NEEDED';`
        );
      } catch {}
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "callPriorityUpdatedAt" TIMESTAMP(3);`
        );
      } catch {}
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "callPriorityUpdatedById" TEXT;`
        );
      } catch {}
    };

    try {
      updated = await prisma.customer.upsert({
        where: { id: trimmedId },
        update: {
          callPriority: normalizedPriority,
          callPriorityUpdatedAt: now,
          callPriorityUpdatedById: staffId,
        },
        create: {
          id: trimmedId,
          name: sanitizedName,
          callPriority: normalizedPriority,
          callPriorityUpdatedAt: now,
          callPriorityUpdatedById: staffId,
        },
        select: {
          id: true,
          callPriority: true,
          name: true,
        },
      });
    } catch (upsertErr: any) {
      // Ensure each column is created individually (avoiding multi-statement raw query failure)
      await ensureColumns();

      // Retry upsert via Prisma Client
      try {
        updated = await prisma.customer.upsert({
          where: { id: trimmedId },
          update: {
            callPriority: normalizedPriority,
            callPriorityUpdatedAt: now,
            callPriorityUpdatedById: staffId,
          },
          create: {
            id: trimmedId,
            name: sanitizedName,
            callPriority: normalizedPriority,
            callPriorityUpdatedAt: now,
            callPriorityUpdatedById: staffId,
          },
          select: {
            id: true,
            callPriority: true,
            name: true,
          },
        });
      } catch {
        // Robust raw SQL fallback: update callPriority safely
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "Customer" ("id", "name", "callPriority", "updatedAt")
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT ("id") DO UPDATE SET
               "callPriority" = $3,
               "updatedAt" = NOW();`,
            trimmedId,
            sanitizedName,
            normalizedPriority
          );
        } catch (rawErr) {
          // Attempt update without insert if table exists
          await prisma.$executeRawUnsafe(
            `UPDATE "Customer" SET "callPriority" = $1, "updatedAt" = NOW() WHERE "id" = $2;`,
            normalizedPriority,
            trimmedId
          );
        }
        updated = {
          id: trimmedId,
          callPriority: normalizedPriority,
          name: sanitizedName,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        customerId: updated.id,
        callPriority: updated.callPriority,
        customerName: updated.name,
      },
    });
  } catch (error: any) {
    console.error('[API /api/accounts/recovery/call-priority Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error persisting call priority' },
      { status: 500 }
    );
  }
}
