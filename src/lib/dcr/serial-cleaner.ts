/**
 * Deterministic Serial Number Normalization Utility
 * 
 * Removes all Unicode whitespace characters from anywhere inside,
 * at the beginning, or at the end of a serial number, without changing
 * letter case, hyphens, slashes, or other punctuation characters.
 */

/**
 * Normalizes a serial number by removing all whitespace characters.
 * Handles ASCII spaces, tabs, newlines, non-breaking spaces (\u00A0),
 * and all Unicode whitespace characters.
 */
export function cleanSerialNumber(serial: string): string {
  if (!serial || typeof serial !== 'string') return '';
  return serial.replace(/\s+/gu, '');
}

/**
 * Checks whether a serial number contains any whitespace character.
 */
export function hasWhitespace(serial: string): boolean {
  if (!serial || typeof serial !== 'string') return false;
  return /\s/u.test(serial);
}

export interface SerialWhitespaceCandidate {
  id: string;
  serialNumber: string;
  status: string;
  skuId?: string | null;
  vendorDcrStatus?: string | null;
}

export interface AnalyzedSerialRow {
  id: string;
  currentSerialNumber: string;
  proposedSerialNumber: string;
  status: string;
  hasWhitespace: boolean;
  isEligible: boolean;
  validationResult: 'ELIGIBLE' | 'ALREADY_CLEAN' | 'SKIPPED_ISSUED' | 'CONFLICT_EXISTS' | 'CONFLICT_BATCH_DUPLICATE' | 'INVALID_EMPTY';
  reason?: string;
}

export interface AnalysisSummary {
  totalScanned: number;
  recordsWithWhitespace: number;
  recordsAlreadyClean: number;
  recordsEligible: number;
  recordsSkippedIssued: number;
  recordsSkippedConflict: number;
}

/**
 * Analyzes a collection of serials against active database records to detect collisions and eligibility.
 */
export function analyzeSerialCandidates(
  candidates: SerialWhitespaceCandidate[],
  allActiveSerialsInDb: Array<{ id: string; serialNumber: string }>
): { rows: AnalyzedSerialRow[]; summary: AnalysisSummary } {
  // Map of existing active serial numbers in the DB (lowercased or exact match)
  const existingMap = new Map<string, { id: string; serialNumber: string }>();
  for (const s of allActiveSerialsInDb) {
    existingMap.set(s.serialNumber, s);
  }

  // Count occurrences of proposed normalized serials within this batch to detect batch collisions
  const batchNormalizedCounts = new Map<string, number>();
  for (const c of candidates) {
    if (c.status !== 'ISSUED' && hasWhitespace(c.serialNumber)) {
      const normalized = cleanSerialNumber(c.serialNumber);
      if (normalized) {
        batchNormalizedCounts.set(normalized, (batchNormalizedCounts.get(normalized) || 0) + 1);
      }
    }
  }

  const rows: AnalyzedSerialRow[] = [];
  let recordsWithWhitespace = 0;
  let recordsAlreadyClean = 0;
  let recordsEligible = 0;
  let recordsSkippedIssued = 0;
  let recordsSkippedConflict = 0;

  for (const c of candidates) {
    const original = c.serialNumber;
    const isIssued = c.status === 'ISSUED';
    const containsWs = hasWhitespace(original);
    const normalized = cleanSerialNumber(original);

    if (containsWs) {
      recordsWithWhitespace++;
    } else {
      recordsAlreadyClean++;
    }

    if (isIssued) {
      recordsSkippedIssued++;
      rows.push({
        id: c.id,
        currentSerialNumber: original,
        proposedSerialNumber: normalized,
        status: c.status,
        hasWhitespace: containsWs,
        isEligible: false,
        validationResult: 'SKIPPED_ISSUED',
        reason: 'Skipped: Serial is in ISSUED lifecycle status',
      });
      continue;
    }

    if (!containsWs) {
      rows.push({
        id: c.id,
        currentSerialNumber: original,
        proposedSerialNumber: original,
        status: c.status,
        hasWhitespace: false,
        isEligible: false,
        validationResult: 'ALREADY_CLEAN',
        reason: 'Serial number contains no whitespace',
      });
      continue;
    }

    if (!normalized || normalized.length === 0) {
      recordsSkippedConflict++;
      rows.push({
        id: c.id,
        currentSerialNumber: original,
        proposedSerialNumber: '',
        status: c.status,
        hasWhitespace: true,
        isEligible: false,
        validationResult: 'INVALID_EMPTY',
        reason: 'Normalized serial number is empty',
      });
      continue;
    }

    // Check collision with another record in DB (id !== c.id)
    const existingOther = existingMap.get(normalized);
    if (existingOther && existingOther.id !== c.id) {
      recordsSkippedConflict++;
      rows.push({
        id: c.id,
        currentSerialNumber: original,
        proposedSerialNumber: normalized,
        status: c.status,
        hasWhitespace: true,
        isEligible: false,
        validationResult: 'CONFLICT_EXISTS',
        reason: `Conflict: Normalized serial "${normalized}" already exists on another record (${existingOther.id})`,
      });
      continue;
    }

    // Check batch collision (two records in candidate set normalizing to same string)
    const countInBatch = batchNormalizedCounts.get(normalized) || 0;
    if (countInBatch > 1) {
      recordsSkippedConflict++;
      rows.push({
        id: c.id,
        currentSerialNumber: original,
        proposedSerialNumber: normalized,
        status: c.status,
        hasWhitespace: true,
        isEligible: false,
        validationResult: 'CONFLICT_BATCH_DUPLICATE',
        reason: `Conflict: Multiple records in batch normalize to "${normalized}"`,
      });
      continue;
    }

    // Fully eligible!
    recordsEligible++;
    rows.push({
      id: c.id,
      currentSerialNumber: original,
      proposedSerialNumber: normalized,
      status: c.status,
      hasWhitespace: true,
      isEligible: true,
      validationResult: 'ELIGIBLE',
      reason: 'Eligible for whitespace removal',
    });
  }

  const summary: AnalysisSummary = {
    totalScanned: candidates.length,
    recordsWithWhitespace,
    recordsAlreadyClean,
    recordsEligible,
    recordsSkippedIssued,
    recordsSkippedConflict,
  };

  return { rows, summary };
}
