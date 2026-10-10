import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cleanSerialNumber, hasWhitespace, analyzeSerialCandidates } from '@/lib/dcr/serial-cleaner';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BATCH_CHUNK_SIZE = 100;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_serial_mapping_override && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: dcr_serial_mapping_override or ADMIN required' }, { status: 403 });
    }

    let idempotencyKey: string | null = null;
    try {
      const body = await req.json();
      idempotencyKey = body?.idempotencyKey || null;
    } catch {
      // Body may be empty
    }

    const batchId = idempotencyKey || `CLEAN_BATCH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const userId = session.userId || 'Unknown';
    const userName = session.name || session.userId || 'Unknown';

    // SERVER RE-SCAN & RE-VALIDATION (Zero Client Trust)
    const allSerials = await prisma.dcrSerial.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        skuId: true,
        vendorDcrStatus: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const activeList = allSerials.map(s => ({ id: s.id, serialNumber: s.serialNumber }));
    const { rows, summary } = analyzeSerialCandidates(allSerials, activeList);

    const eligibleRows = rows.filter(r => r.isEligible && r.validationResult === 'ELIGIBLE');
    const skippedRows = rows.filter(r => r.hasWhitespace && !r.isEligible);

    if (eligibleRows.length === 0) {
      return NextResponse.json({
        success: true,
        batchId,
        message: 'No eligible serial numbers requiring whitespace removal.',
        totalScanned: summary.totalScanned,
        recordsWithWhitespace: summary.recordsWithWhitespace,
        correctedCount: 0,
        recordsAlreadyClean: summary.recordsAlreadyClean,
        skippedIssuedCount: summary.recordsSkippedIssued,
        conflictsCount: summary.recordsSkippedConflict,
        correctedRecords: [],
        skippedRecords: skippedRows,
      });
    }

    const committedRecords: Array<{
      id: string;
      originalSerialNumber: string;
      correctedSerialNumber: string;
      previousStatus: string;
    }> = [];
    const executionSkipped: Array<{
      id: string;
      serialNumber: string;
      reason: string;
    }> = [];

    // Process eligible updates in bounded transaction chunks
    for (let i = 0; i < eligibleRows.length; i += BATCH_CHUNK_SIZE) {
      const chunk = eligibleRows.slice(i, i + BATCH_CHUNK_SIZE);

      await prisma.$transaction(async (tx) => {
        for (const item of chunk) {
          // Re-fetch record live within transaction to prevent race conditions
          const fresh = await tx.dcrSerial.findUnique({
            where: { id: item.id }
          });

          if (!fresh || fresh.isDeleted) {
            executionSkipped.push({
              id: item.id,
              serialNumber: item.currentSerialNumber,
              reason: 'Record deleted or not found during execution',
            });
            continue;
          }

          if (fresh.status === 'ISSUED') {
            executionSkipped.push({
              id: item.id,
              serialNumber: fresh.serialNumber,
              reason: 'Record status changed to ISSUED prior to execution',
            });
            continue;
          }

          if (fresh.serialNumber !== item.currentSerialNumber) {
            executionSkipped.push({
              id: item.id,
              serialNumber: fresh.serialNumber,
              reason: `Serial number changed concurrently (now: "${fresh.serialNumber}")`,
            });
            continue;
          }

          const targetNormalized = item.proposedSerialNumber;

          // Check if another active record holds this normalized number
          const collision = await tx.dcrSerial.findFirst({
            where: {
              serialNumber: targetNormalized,
              id: { not: fresh.id },
              isDeleted: false,
            }
          });

          if (collision) {
            executionSkipped.push({
              id: item.id,
              serialNumber: fresh.serialNumber,
              reason: `Collision: "${targetNormalized}" claimed by another record (${collision.id})`,
            });
            continue;
          }

          // Clear any soft-deleted squatter on the normalized serial number
          const squatter = await tx.dcrSerial.findUnique({
            where: { serialNumber: targetNormalized }
          });
          if (squatter && squatter.isDeleted && squatter.id !== fresh.id) {
            await tx.dcrSerial.update({
              where: { id: squatter.id },
              data: { serialNumber: `${squatter.serialNumber}_DEL_${Date.now()}` }
            });
          }

          // Update DcrSerial (PostgreSQL cascades serialNumber update to DcrSerialAllocation)
          await tx.dcrSerial.update({
            where: { id: fresh.id },
            data: { serialNumber: targetNormalized }
          });

          // Record history entry for audit trail
          await tx.dcrSerialHistory.create({
            data: {
              serialId: fresh.id,
              eventType: 'CORRECTION_BULK_WHITESPACE_CLEAN',
              eventDescription: JSON.stringify({
                operation: 'BULK_WHITESPACE_CLEAN',
                recordId: fresh.id,
                originalSerialNumber: fresh.serialNumber,
                correctedSerialNumber: targetNormalized,
                previousStatus: fresh.status,
                changedBy: userName,
                changedOn: new Date().toISOString(),
                batchId,
                reason: 'Bulk whitespace removal from non-issued serial number',
              }),
              userId: userId,
            }
          });

          committedRecords.push({
            id: fresh.id,
            originalSerialNumber: fresh.serialNumber,
            correctedSerialNumber: targetNormalized,
            previousStatus: fresh.status,
          });
        }
      });
    }

    // Record Batch Audit Log in DcrAuditLog
    try {
      await prisma.dcrAuditLog.create({
        data: {
          entityType: 'SERIAL_CLEAN_BATCH',
          entityId: batchId,
          action: 'BULK_WHITESPACE_CLEAN',
          userId: userId,
          metadata: {
            batchId,
            totalScanned: summary.totalScanned,
            recordsWithWhitespace: summary.recordsWithWhitespace,
            correctedCount: committedRecords.length,
            recordsAlreadyClean: summary.recordsAlreadyClean,
            skippedIssuedCount: summary.recordsSkippedIssued,
            conflictsCount: summary.recordsSkippedConflict + executionSkipped.length,
            committedRecords: committedRecords.slice(0, 100),
            skippedDetails: [...skippedRows, ...executionSkipped].slice(0, 100),
            idempotencyKey,
          } as any
        }
      });
    } catch (auditErr) {
      console.error('[Clean Whitespace Confirm] Audit log write failed:', auditErr);
    }

    return NextResponse.json({
      success: true,
      batchId,
      totalScanned: summary.totalScanned,
      recordsWithWhitespace: summary.recordsWithWhitespace,
      correctedCount: committedRecords.length,
      recordsAlreadyClean: summary.recordsAlreadyClean,
      skippedIssuedCount: summary.recordsSkippedIssued,
      conflictsCount: summary.recordsSkippedConflict + executionSkipped.length,
      correctedRecords: committedRecords,
      skippedRecords: [...skippedRows, ...executionSkipped],
    });
  } catch (error: any) {
    console.error('[Clean Whitespace Confirm POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to clean serial numbers' }, { status: 500 });
  }
}
