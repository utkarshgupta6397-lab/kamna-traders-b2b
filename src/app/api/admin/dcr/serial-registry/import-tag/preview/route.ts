import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseTabularRemarks, resolveDuplicates } from '@/lib/dcr/tag-import-parser';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'No input text provided' }, { status: 400 });
    }

    if (text.length > 5 * 1024 * 1024) { // 5MB guard
      return NextResponse.json({ error: 'Input size exceeds maximum allowed limit' }, { status: 400 });
    }

    // Parse tabular input
    const parsedRows = parseTabularRemarks(text);
    if (parsedRows.length === 0) {
      return NextResponse.json({ error: 'No valid data rows found in input' }, { status: 400 });
    }

    // Resolve duplicates (Last Valid Occurrence Wins)
    const { resolvedRows, summary } = resolveDuplicates(parsedRows);

    // Bulk lookup existing DCR serials with vendorDcrStatus
    const uniqueSerials = Array.from(new Set(resolvedRows.map(r => r.serialNumber).filter(Boolean)));

    const existingDcrSerials = await prisma.dcrSerial.findMany({
      where: {
        serialNumber: { in: uniqueSerials },
        isDeleted: false,
      },
      select: {
        id: true,
        serialNumber: true,
        vendorDcrStatus: true,
        tag: {
          select: { tag: true }
        }
      }
    });

    const dcrMap = new Map(existingDcrSerials.map(s => [s.serialNumber, s]));

    let eligibleForImport = 0;
    let skippedVendorDcr = 0;
    let serialNotFound = 0;

    const enrichedRows = resolvedRows.map(row => {
      const dcr = dcrMap.get(row.serialNumber);
      const inDcr = Boolean(dcr);
      const currentVendorDcrStatus = dcr ? (dcr.vendorDcrStatus || 'NOT_RECEIVED') : null;
      const currentTag = dcr?.tag?.tag || null;

      let vendorDcrEligibility:
        | 'ELIGIBLE_NOT_RECEIVED'
        | 'SKIPPED_ALREADY_RECEIVED'
        | 'SKIPPED_OTHER_STATUS'
        | 'SKIPPED_SERIAL_NOT_FOUND'
        | 'NEEDS_REVIEW'
        | 'DUPLICATE_SKIPPED';

      let action:
        | 'UPDATE_EXISTING'
        | 'SKIP_VENDOR_DCR'
        | 'SKIP_NOT_FOUND'
        | 'SKIP_DUPLICATE'
        | 'NEEDS_REVIEW'
        | 'INVALID_INPUT' = 'NEEDS_REVIEW';

      let validationResult: string = row.validationResult;
      let reason: string = row.reason || '';

      if (row.action === 'SKIP_DUPLICATE') {
        vendorDcrEligibility = 'DUPLICATE_SKIPPED';
        action = 'SKIP_DUPLICATE';
        validationResult = 'DUPLICATE_INPUT';
      } else if (row.status === 'MALFORMED') {
        vendorDcrEligibility = 'NEEDS_REVIEW';
        action = 'INVALID_INPUT';
        validationResult = 'MALFORMED_ROW';
      } else if (row.status === 'NEEDS_REVIEW') {
        vendorDcrEligibility = 'NEEDS_REVIEW';
        action = 'NEEDS_REVIEW';
        validationResult = 'NEEDS_REVIEW';
      } else if (!inDcr) {
        // Serial not found in DCR Registry: restricted workflow skips without creating tag-only
        vendorDcrEligibility = 'SKIPPED_SERIAL_NOT_FOUND';
        action = 'SKIP_NOT_FOUND';
        validationResult = 'SERIAL_NOT_FOUND';
        reason = 'Skipped — Serial not found in DCR Registry';
        serialNotFound++;
      } else if (currentVendorDcrStatus === 'NOT_RECEIVED') {
        // Canonical stored value for "Not Received" is NOT_RECEIVED
        vendorDcrEligibility = 'ELIGIBLE_NOT_RECEIVED';
        action = 'UPDATE_EXISTING';
        validationResult = 'READY_TO_IMPORT';
        eligibleForImport++;
      } else if (currentVendorDcrStatus === 'RECEIVED') {
        vendorDcrEligibility = 'SKIPPED_ALREADY_RECEIVED';
        action = 'SKIP_VENDOR_DCR';
        validationResult = 'SKIPPED_VENDOR_DCR';
        reason = 'Skipped — Vendor DCR status is already Received';
        skippedVendorDcr++;
      } else {
        vendorDcrEligibility = 'SKIPPED_OTHER_STATUS';
        action = 'SKIP_VENDOR_DCR';
        validationResult = 'SKIPPED_VENDOR_DCR';
        reason = `Skipped — Vendor DCR status is not Not Received (current: ${currentVendorDcrStatus})`;
        skippedVendorDcr++;
      }

      return {
        rowNumber: row.rowNumber,
        serialNumber: row.serialNumber,
        originalRemarks: row.originalRemarks,
        extractedTag: row.extractedTag,
        rule: row.rule,
        registryMatch: inDcr ? 'DCR_SERIAL' : 'NOT_IN_DCR',
        vendorDcrStatus: currentVendorDcrStatus,
        vendorDcrEligibility,
        currentTag,
        proposedTag: row.extractedTag,
        action,
        validationResult,
        isDuplicate: row.isDuplicate,
        duplicateGroupTotal: row.duplicateGroupTotal,
        occurrenceIndex: row.occurrenceIndex,
        isSelectedOccurrence: row.isSelectedOccurrence,
        duplicateNote: row.duplicateNote,
        reason,
      };
    });

    const enrichedSummary = {
      totalParsedRows: summary.totalParsedRows,
      uniqueSerials: summary.uniqueSerials,
      eligibleForImport,
      skippedVendorDcr,
      serialNotFound,
      duplicateRows: summary.skippedDuplicatesCount,
      needsReviewCount: summary.needsReviewCount + summary.malformedCount,
      actionableRowsCount: eligibleForImport,
    };

    return NextResponse.json({
      success: true,
      summary: enrichedSummary,
      rows: enrichedRows,
    });
  } catch (error: any) {
    console.error('[DCR Tag Import Preview POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to preview tag import' }, { status: 500 });
  }
}
