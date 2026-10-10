import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseTabularRemarks, resolveDuplicates } from '@/lib/dcr/tag-import-parser';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const BATCH_CHUNK_SIZE = 250;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { text, idempotencyKey } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No input text provided' }, { status: 400 });
    }

    if (text.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Input size exceeds maximum allowed limit' }, { status: 400 });
    }

    // RE-PARSE AND RE-EXTRACT COMPLETELY ON SERVER (Zero Client Trust)
    const parsedRows = parseTabularRemarks(text);
    if (parsedRows.length === 0) {
      return NextResponse.json({ error: 'No valid data rows found in input' }, { status: 400 });
    }

    const { resolvedRows, summary } = resolveDuplicates(parsedRows);

    // Filter to candidate rows: only selected winning valid occurrences
    const candidateRows = resolvedRows.filter(
      r => r.isSelectedOccurrence && r.status === 'VALID' && r.extractedTag !== null
    );

    if (candidateRows.length === 0) {
      return NextResponse.json({
        error: 'No valid rows available to import. Please review and resolve errors before confirming.',
      }, { status: 400 });
    }

    const batchId = idempotencyKey || `BATCH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const userId = session.userId || 'Unknown';
    const userName = session.name || session.userId || 'Unknown';

    // Collect candidate serials for bulk DB query
    const serialNumbers = candidateRows.map(r => r.serialNumber);

    // Query current live database state: strictly DcrSerial with vendorDcrStatus
    const existingDcrSerials = await prisma.dcrSerial.findMany({
      where: {
        serialNumber: { in: serialNumbers },
        isDeleted: false,
      },
      select: {
        id: true,
        serialNumber: true,
        vendorDcrStatus: true,
      }
    });

    const dcrMap = new Map(existingDcrSerials.map(s => [s.serialNumber, s]));

    // Strictly enforce Vendor DCR status === 'NOT_RECEIVED'
    const eligibleUpdates: Array<{ serialId: string; serialNumber: string; tag: string }> = [];
    const skippedVendorDcr: Array<{ serialNumber: string; reason: string; status: string }> = [];
    const skippedNotFound: Array<{ serialNumber: string; reason: string }> = [];

    for (const row of candidateRows) {
      const tagValue = row.extractedTag!.trim();
      const dcr = dcrMap.get(row.serialNumber);

      if (!dcr) {
        // Serial not found in DCR Registry: skip without creating tag-only records
        skippedNotFound.push({
          serialNumber: row.serialNumber,
          reason: 'Skipped — Serial not found in DCR Registry',
        });
        continue;
      }

      const currentVendorStatus = dcr.vendorDcrStatus || 'NOT_RECEIVED';
      if (currentVendorStatus !== 'NOT_RECEIVED') {
        const reason = currentVendorStatus === 'RECEIVED'
          ? 'Skipped — Vendor DCR status is already Received'
          : `Skipped — Vendor DCR status is not Not Received (current: ${currentVendorStatus})`;
        skippedVendorDcr.push({
          serialNumber: row.serialNumber,
          reason,
          status: currentVendorStatus,
        });
        continue;
      }

      eligibleUpdates.push({
        serialId: dcr.id,
        serialNumber: dcr.serialNumber,
        tag: tagValue,
      });
    }

    let committedDcrUpdates = 0;
    const failedRows: Array<{ serialNumber: string; reason: string }> = [];

    // Process eligible DCR updates in bounded transaction chunks
    for (let i = 0; i < eligibleUpdates.length; i += BATCH_CHUNK_SIZE) {
      const chunk = eligibleUpdates.slice(i, i + BATCH_CHUNK_SIZE);
      const chunkSerialIds = chunk.map(c => c.serialId);

      try {
        await prisma.$transaction(async (tx) => {
          // Re-verify strictly inside transaction to prevent concurrency / status change race conditions
          const freshEligible = await tx.dcrSerial.findMany({
            where: {
              id: { in: chunkSerialIds },
              vendorDcrStatus: 'NOT_RECEIVED',
              isDeleted: false,
            },
            select: { id: true, serialNumber: true }
          });

          const freshEligibleIds = new Set(freshEligible.map(s => s.id));
          const strictlyEligibleChunk = chunk.filter(c => freshEligibleIds.has(c.serialId));

          // If any serial changed status concurrently, record as skipped
          const concurrentlyChanged = chunk.filter(c => !freshEligibleIds.has(c.serialId));
          concurrentlyChanged.forEach(c => {
            skippedVendorDcr.push({
              serialNumber: c.serialNumber,
              reason: 'Skipped — Vendor DCR status changed concurrently from Not Received',
              status: 'CHANGED_CONCURRENTLY',
            });
          });

          if (strictlyEligibleChunk.length === 0) return;

          const strictlyEligibleIds = strictlyEligibleChunk.map(c => c.serialId);

          // Delete existing SerialTag records for these serials
          await tx.serialTag.deleteMany({
            where: { serialId: { in: strictlyEligibleIds } }
          });

          // Insert new SerialTag records
          await tx.serialTag.createMany({
            data: strictlyEligibleChunk.map(c => ({
              serialId: c.serialId,
              tag: c.tag,
              createdBy: userName,
            }))
          });

          // Record history entries strictly as TAG_UPDATED (no lifecycle alterations)
          await tx.dcrSerialHistory.createMany({
            data: strictlyEligibleChunk.map(c => ({
              serialId: c.serialId,
              eventType: 'TAG_UPDATED',
              eventDescription: `Tag updated via vendor DCR import: ${c.tag}`,
              userId: userId,
            }))
          });

          committedDcrUpdates += strictlyEligibleChunk.length;
        });
      } catch (chunkErr: any) {
        console.error(`[Import Confirm] Error updating DCR chunk:`, chunkErr);
        chunk.forEach(c => {
          failedRows.push({
            serialNumber: c.serialNumber,
            reason: chunkErr.message || 'Transaction failed for DCR serial tag update',
          });
        });
      }
    }

    // Record Batch Audit Log in DcrAuditLog
    try {
      await prisma.dcrAuditLog.create({
        data: {
          entityType: 'TAG_IMPORT_BATCH',
          entityId: batchId,
          action: 'IMPORT_TAGS',
          userId: userId,
          metadata: {
            batchId,
            totalParsed: summary.totalParsedRows,
            uniqueSerials: summary.uniqueSerials,
            eligibleForImport: eligibleUpdates.length,
            dcrSerialsUpdated: committedDcrUpdates,
            skippedVendorDcr: skippedVendorDcr.length,
            serialNotFound: skippedNotFound.length,
            skippedDuplicates: summary.skippedDuplicatesCount,
            failedRowsCount: failedRows.length,
            skippedVendorDcrDetails: skippedVendorDcr.slice(0, 100),
            skippedNotFoundDetails: skippedNotFound.slice(0, 100),
            failedRows: failedRows.slice(0, 100),
            idempotencyKey: idempotencyKey || null,
          }
        }
      });
    } catch (auditErr) {
      console.error('[Import Confirm] Audit log failed to write:', auditErr);
    }

    return NextResponse.json({
      success: true,
      batchId,
      totalParsed: summary.totalParsedRows,
      uniqueSerials: summary.uniqueSerials,
      eligibleForImport: eligibleUpdates.length,
      dcrSerialsUpdated: committedDcrUpdates,
      skippedVendorDcr: skippedVendorDcr.length,
      serialNotFound: skippedNotFound.length,
      skippedDuplicates: summary.skippedDuplicatesCount,
      failedRowsCount: failedRows.length,
      skippedVendorDcrDetails: skippedVendorDcr,
      skippedNotFoundDetails: skippedNotFound,
      errors: failedRows,
    });
  } catch (error: any) {
    console.error('[DCR Tag Import Confirm POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to confirm tag import' }, { status: 500 });
  }
}
