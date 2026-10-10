/**
 * Dedicated parser and tag extraction utility for DCR Serial Tag imports.
 * 
 * Handles:
 * - TSV, multi-space, and quoted tabular formats
 * - Header row detection and exclusion
 * - Multiline continuation remarks (vendor chains)
 * - Rule A: "Invalid serial number" -> "No Data" (takes precedence)
 * - Rule B: Last business/person entity immediately before `Claimed` marker in `->` vendor chains
 * - Rule C: Flagging missing/unrecognized remarks (including chains missing `Claimed`) for review
 * - Duplicate handling: Last valid occurrence wins, with complete tracking of all occurrences
 */

export interface ParsedRawRow {
  rowNumber: number;
  serialNumber: string;
  originalRemarks: string;
  isHeader?: boolean;
  isMalformed?: boolean;
  malformedReason?: string;
}

export interface TagExtractionResult {
  tag: string | null;
  rule: 'RULE_A_CHAIN_WITH_CLAIMED' | 'RULE_B_CHAIN_WITHOUT_CLAIMED' | 'RULE_B_VENDOR_CHAIN' | 'EXPLICIT_NO_DATA' | null;
  status: 'VALID' | 'NEEDS_REVIEW' | 'MALFORMED';
  reason?: string;
}

export interface ParsedRow {
  rowNumber: number;
  serialNumber: string;
  originalRemarks: string;
  extractedTag: string | null;
  rule: 'RULE_A_CHAIN_WITH_CLAIMED' | 'RULE_B_CHAIN_WITHOUT_CLAIMED' | 'RULE_B_VENDOR_CHAIN' | 'EXPLICIT_NO_DATA' | null;
  status: 'VALID' | 'NEEDS_REVIEW' | 'MALFORMED';
  reason?: string;
}

export interface DuplicateResolvedRow extends ParsedRow {
  isDuplicate: boolean;
  duplicateGroupTotal: number;
  occurrenceIndex: number;
  isSelectedOccurrence: boolean;
  duplicateNote?: string;
  action: 'UPDATE_EXISTING' | 'CREATE_TAG_ONLY' | 'SKIP_DUPLICATE' | 'NEEDS_REVIEW' | 'INVALID_INPUT';
  validationResult: 'READY_TO_IMPORT' | 'DUPLICATE_INPUT' | 'MALFORMED_ROW' | 'NEEDS_REVIEW';
}

export interface ParseSummary {
  totalParsedRows: number;
  uniqueSerials: number;
  duplicateSerialsCount: number;
  validRowsCount: number;
  needsReviewCount: number;
  malformedCount: number;
  skippedDuplicatesCount: number;
}

/**
 * Normalizes newlines across Windows (\r\n), Mac (\r), and Unix (\n).
 */
export function normalizeNewlines(input: string): string {
  if (!input) return '';
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Checks whether a line appears to be a column header.
 */
export function isHeaderLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  if (!trimmed) return false;

  const headerPatterns = [
    /^serial\s*number/i,
    /^serial\s*no/i,
    /^sl\.?\s*no/i,
    /^sr\.?\s*no/i,
    /^serial\t/i,
  ];

  if (headerPatterns.some(p => p.test(trimmed))) {
    return true;
  }

  // Also check if split columns match common header names
  const cols = trimmed.split(/[\t]+/).map(c => c.trim());
  if (cols.length >= 2) {
    const col0 = cols[0];
    const col1 = cols[1];
    if (
      (col0 === 'serial' || col0 === 'serial number' || col0 === 'serial no' || col0 === 'sr no') &&
      (col1.includes('remark') || col1.includes('error') || col1.includes('status') || col1.includes('tag'))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a line is a vendor chain continuation line (e.g. contains `->` without a separate serial column).
 */
export function isVendorChainContinuation(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('->')) return false;

  if (!line.includes('\t')) {
    return true;
  }

  const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
  if (parts.length === 1 && parts[0].includes('->')) {
    return true;
  }

  return false;
}

/**
 * Extracts a serial tag according to the business rules:
 * - Rule A: When a chain contains a valid `Claimed` marker, extract the entity immediately preceding the marker.
 * - Rule B: When there is no `Claimed` marker, extract the last valid entity in the vendor chain (e.g. Waaree -> AMR -> Kamna Traders).
 * - Rule C: If remarks contain only an error message (e.g. Invalid serial number...) or no valid chain, return None (null).
 * - Rule D: Normalization: trim whitespace, preserve internal spaces and punctuation/parentheses.
 */
export function extractSerialTag(remarks: string): TagExtractionResult {
  const cleanRemarks = (remarks || '').trim();

  if (!cleanRemarks) {
    return {
      tag: null,
      rule: null,
      status: 'NEEDS_REVIEW',
      reason: 'No error remarks or vendor chain provided',
    };
  }

  // Explicit "No Data" tag input
  if (cleanRemarks.toLowerCase() === 'no data') {
    return {
      tag: 'No Data',
      rule: 'EXPLICIT_NO_DATA',
      status: 'VALID',
    };
  }

  // RULE C: If there is no vendor chain delimiter '->'
  if (!cleanRemarks.includes('->')) {
    const isInvalidSerial = /invalid\s+serial\s+number/i.test(cleanRemarks);
    return {
      tag: null,
      rule: null,
      status: 'NEEDS_REVIEW',
      reason: isInvalidSerial
        ? 'Remarks contain invalid-serial error with no vendor chain'
        : 'Remarks do not contain a recognized vendor chain',
    };
  }

  // Isolating vendor-chain portion (Entities separated by `->`)
  // Error remarks might have prefix lines like "Panel is not in your stock (not claimed or already sold)"
  // Isolate only the line(s) containing the chain '->'
  const lines = cleanRemarks.split('\n').map(l => l.trim()).filter(Boolean);
  const chainLines = lines.filter(l => l.includes('->'));
  const chainText = chainLines.length > 0 ? chainLines.join(' ') : cleanRemarks;

  // Split chain into raw segments separated by '->'
  const rawSegments = chainText
    .split('->')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Must have at least manufacturer and one downstream entity
  if (rawSegments.length < 2) {
    return {
      tag: null,
      rule: null,
      status: 'NEEDS_REVIEW',
      reason: 'Vendor chain does not contain valid downstream entities',
    };
  }

  const mfrName = rawSegments[0].replace(/[\s\-_:–—]+$/, '').trim();

  // 1. Check for `Claimed` marker in downstream segments (index >= 1)
  // Introductory text (before the first '->') might contain phrases like "(not claimed or already sold)".
  // The actual Claimed marker is located downstream.
  const claimedRegex = /\bclaimed\b/i;
  let claimedSegmentIndex = -1;
  for (let i = rawSegments.length - 1; i >= 1; i--) {
    if (claimedRegex.test(rawSegments[i])) {
      claimedSegmentIndex = i;
      break;
    }
  }

  // -------------------------------------------------------------
  // RULE A: Chain contains `Claimed`
  // -------------------------------------------------------------
  if (claimedSegmentIndex !== -1) {
    const claimedSegment = rawSegments[claimedSegmentIndex];
    let candidateEntity = '';

    // Check if the segment itself is just "Claimed" (e.g. `... -> Entity -> Claimed -> Govt ID`)
    const strippedClaimed = claimedSegment.replace(claimedRegex, '').trim();
    if (!strippedClaimed || /^[\s\-_:–—[\]()]+$/.test(strippedClaimed)) {
      // The entity is the previous segment immediately before Claimed
      if (claimedSegmentIndex - 1 < 1) {
        return {
          tag: null,
          rule: 'RULE_A_CHAIN_WITH_CLAIMED',
          status: 'NEEDS_REVIEW',
          reason: 'No entity found before "Claimed" marker (only manufacturer present)',
        };
      }
      candidateEntity = rawSegments[claimedSegmentIndex - 1];
    } else {
      // The entity is within this segment, immediately before the "Claimed" marker
      // e.g. "Mrs.Kesho Devi (SBS-89) Claimed"
      const match = claimedRegex.exec(claimedSegment);
      if (match && match.index > 0) {
        candidateEntity = claimedSegment.substring(0, match.index).trim();
      } else if (claimedSegmentIndex - 1 >= 1) {
        // "Claimed" was at index 0 of segment, so entity was previous segment
        candidateEntity = rawSegments[claimedSegmentIndex - 1];
      }
    }

    // Remove only trailing whitespace / connector punctuation while preserving
    // original name, parentheses, codes, hyphens, and slashes.
    candidateEntity = candidateEntity.replace(/[\s\-_:–—]+$/, '').trim();

    if (!candidateEntity) {
      return {
        tag: null,
        rule: 'RULE_A_CHAIN_WITH_CLAIMED',
        status: 'NEEDS_REVIEW',
        reason: 'Entity immediately before "Claimed" marker is missing or could not be identified',
      };
    }

    // Do not extract the manufacturer (first segment)
    if (candidateEntity.toLowerCase() === mfrName.toLowerCase()) {
      return {
        tag: null,
        rule: 'RULE_A_CHAIN_WITH_CLAIMED',
        status: 'NEEDS_REVIEW',
        reason: 'Extracted entity cannot be the manufacturer',
      };
    }

    return {
      tag: candidateEntity,
      rule: 'RULE_A_CHAIN_WITH_CLAIMED',
      status: 'VALID',
    };
  }

  // -------------------------------------------------------------
  // RULE B: Chain does not contain `Claimed`
  // Extract the last valid entity in the vendor chain
  // e.g. Waaree Energies Limited -> AMR Power Solutions (5601016510) -> Kamna Traders (461)
  // Expected tag: Kamna Traders (461)
  // -------------------------------------------------------------
  let lastEntityCandidate = '';
  for (let i = rawSegments.length - 1; i >= 1; i--) {
    const cleaned = rawSegments[i].replace(/[\s\-_:–—]+$/, '').trim();
    if (cleaned && !/^[\s\-_:–—[\]()]+$/.test(cleaned)) {
      lastEntityCandidate = cleaned;
      break;
    }
  }

  if (!lastEntityCandidate) {
    return {
      tag: null,
      rule: 'RULE_B_CHAIN_WITHOUT_CLAIMED',
      status: 'NEEDS_REVIEW',
      reason: 'No valid downstream entity found in vendor chain',
    };
  }

  if (lastEntityCandidate.toLowerCase() === mfrName.toLowerCase()) {
    return {
      tag: null,
      rule: 'RULE_B_CHAIN_WITHOUT_CLAIMED',
      status: 'NEEDS_REVIEW',
      reason: 'Extracted entity cannot be the manufacturer',
    };
  }

  return {
    tag: lastEntityCandidate,
    rule: 'RULE_B_CHAIN_WITHOUT_CLAIMED',
    status: 'VALID',
  };
}

/**
 * Parses raw tabular/multiline text input into structured records.
 */
export function parseTabularRemarks(rawText: string): ParsedRow[] {
  const normalized = normalizeNewlines(rawText);
  const rawLines = normalized.split('\n');

  const parsedRows: ParsedRow[] = [];
  let currentActiveRow: ParsedRawRow | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    const sourceLineNumber = i + 1;

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Check for header
    if (isHeaderLine(trimmed)) {
      continue;
    }

    // Check if line is a vendor chain continuation line
    if (currentActiveRow && isVendorChainContinuation(trimmed)) {
      currentActiveRow.originalRemarks = currentActiveRow.originalRemarks
        ? `${currentActiveRow.originalRemarks}\n${trimmed}`
        : trimmed;
      continue;
    }

    // Check if line is tab-separated or multi-space separated
    let serialCol = '';
    let remarksCol = '';

    if (rawLine.includes('\t')) {
      const tokens = rawLine.split('\t');
      serialCol = tokens[0]?.trim() || '';
      remarksCol = tokens.slice(1).join('\t').trim();
    } else {
      // Check multi-space separation (2 or more spaces)
      const multiSpaceMatch = trimmed.match(/^([^\s]+)\s{2,}(.+)$/);
      if (multiSpaceMatch) {
        serialCol = multiSpaceMatch[1].trim();
        remarksCol = multiSpaceMatch[2].trim();
      } else {
        // Single column line without tab or multi-space
        // Could be a continuation remark if there is an active row and no serial format
        if (currentActiveRow && (trimmed.includes('->') || trimmed.toLowerCase().includes('panel is not') || trimmed.toLowerCase().includes('sold') || trimmed.toLowerCase().includes('stock'))) {
          currentActiveRow.originalRemarks = currentActiveRow.originalRemarks
            ? `${currentActiveRow.originalRemarks}\n${trimmed}`
            : trimmed;
          continue;
        }

        // Otherwise treat the token as serial with empty remark
        serialCol = trimmed;
        remarksCol = '';
      }
    }

    // If we have an existing active row, finalize it
    if (currentActiveRow) {
      const extraction = extractSerialTag(currentActiveRow.originalRemarks);
      parsedRows.push({
        rowNumber: currentActiveRow.rowNumber,
        serialNumber: currentActiveRow.serialNumber,
        originalRemarks: currentActiveRow.originalRemarks,
        extractedTag: extraction.tag,
        rule: extraction.rule,
        status: extraction.status,
        reason: extraction.reason,
      });
      currentActiveRow = null;
    }

    // Validate serial number: non-empty string, preserve leading zeros, no space in serial number
    if (!serialCol) {
      parsedRows.push({
        rowNumber: sourceLineNumber,
        serialNumber: '',
        originalRemarks: remarksCol,
        extractedTag: null,
        rule: null,
        status: 'MALFORMED',
        reason: 'Missing serial number',
      });
      continue;
    }

    // Serial numbers should not contain spaces or start with known non-serial phrases
    if (/\s/.test(serialCol) && !rawLine.includes('\t')) {
      parsedRows.push({
        rowNumber: sourceLineNumber,
        serialNumber: serialCol,
        originalRemarks: remarksCol,
        extractedTag: null,
        rule: null,
        status: 'MALFORMED',
        reason: 'Malformed row: serial number contains whitespace',
      });
      continue;
    }

    currentActiveRow = {
      rowNumber: sourceLineNumber,
      serialNumber: serialCol,
      originalRemarks: remarksCol,
    };
  }

  // Finalize any trailing active row
  if (currentActiveRow) {
    const extraction = extractSerialTag(currentActiveRow.originalRemarks);
    parsedRows.push({
      rowNumber: currentActiveRow.rowNumber,
      serialNumber: currentActiveRow.serialNumber,
      originalRemarks: currentActiveRow.originalRemarks,
      extractedTag: extraction.tag,
      rule: extraction.rule,
      status: extraction.status,
      reason: extraction.reason,
    });
  }

  return parsedRows;
}

/**
 * Resolves duplicates according to "Last Valid Occurrence Wins":
 * - Scans rows in source order.
 * - If a serial appears multiple times, the LAST VALID occurrence wins.
 * - Earlier occurrences are marked as SKIP_DUPLICATE.
 * - If final occurrence is malformed or needs review, earlier valid occurrences are preserved.
 */
export function resolveDuplicates(rows: ParsedRow[]): {
  resolvedRows: DuplicateResolvedRow[];
  summary: ParseSummary;
} {
  // Group rows by serialNumber
  const serialGroups = new Map<string, ParsedRow[]>();

  for (const row of rows) {
    if (!row.serialNumber) continue;
    const existing = serialGroups.get(row.serialNumber) || [];
    existing.push(row);
    serialGroups.set(row.serialNumber, existing);
  }

  const resolvedRows: DuplicateResolvedRow[] = [];
  let uniqueSerials = 0;
  let duplicateSerialsCount = 0;
  let skippedDuplicatesCount = 0;
  let validRowsCount = 0;
  let needsReviewCount = 0;
  let malformedCount = 0;

  for (const row of rows) {
    // If malformed due to missing serial
    if (!row.serialNumber || row.status === 'MALFORMED') {
      malformedCount++;
      resolvedRows.push({
        ...row,
        isDuplicate: false,
        duplicateGroupTotal: 1,
        occurrenceIndex: 1,
        isSelectedOccurrence: false,
        action: 'INVALID_INPUT',
        validationResult: 'MALFORMED_ROW',
      });
      continue;
    }

    const group = serialGroups.get(row.serialNumber)!;
    const isDuplicate = group.length > 1;
    const occurrenceIndex = group.indexOf(row) + 1;

    // Find the winning occurrence: last valid occurrence in group
    // A valid occurrence is one where status === 'VALID' and extractedTag is non-null
    const validOccurrences = group.filter(r => r.status === 'VALID' && r.extractedTag !== null);
    const winningOccurrence = validOccurrences.length > 0 
      ? validOccurrences[validOccurrences.length - 1] 
      : group[group.length - 1]; // fallback to last if none valid

    const isWinner = row === winningOccurrence && row.status === 'VALID';

    if (isDuplicate) {
      if (occurrenceIndex === 1) {
        duplicateSerialsCount++;
      }
    }

    if (row.status === 'NEEDS_REVIEW') {
      needsReviewCount++;
      resolvedRows.push({
        ...row,
        isDuplicate,
        duplicateGroupTotal: group.length,
        occurrenceIndex,
        isSelectedOccurrence: false,
        duplicateNote: isDuplicate ? `Occurrence ${occurrenceIndex} of ${group.length}` : undefined,
        action: 'NEEDS_REVIEW',
        validationResult: 'NEEDS_REVIEW',
      });
    } else if (isDuplicate && !isWinner) {
      skippedDuplicatesCount++;
      resolvedRows.push({
        ...row,
        isDuplicate,
        duplicateGroupTotal: group.length,
        occurrenceIndex,
        isSelectedOccurrence: false,
        duplicateNote: `Occurrence ${occurrenceIndex} of ${group.length} (Skipped in favor of row ${winningOccurrence.rowNumber})`,
        action: 'SKIP_DUPLICATE',
        validationResult: 'DUPLICATE_INPUT',
      });
    } else if (row.status === 'VALID' && isWinner) {
      validRowsCount++;
      resolvedRows.push({
        ...row,
        isDuplicate,
        duplicateGroupTotal: group.length,
        occurrenceIndex,
        isSelectedOccurrence: true,
        duplicateNote: isDuplicate ? `Occurrence ${occurrenceIndex} of ${group.length} (Selected - Last Valid Occurrence)` : undefined,
        action: 'UPDATE_EXISTING',
        validationResult: 'READY_TO_IMPORT',
      });
    } else {
      needsReviewCount++;
      resolvedRows.push({
        ...row,
        isDuplicate,
        duplicateGroupTotal: group.length,
        occurrenceIndex,
        isSelectedOccurrence: false,
        action: 'NEEDS_REVIEW',
        validationResult: 'NEEDS_REVIEW',
      });
    }
  }

  uniqueSerials = serialGroups.size;

  const summary: ParseSummary = {
    totalParsedRows: rows.length,
    uniqueSerials,
    duplicateSerialsCount,
    validRowsCount,
    needsReviewCount,
    malformedCount,
    skippedDuplicatesCount,
  };

  return { resolvedRows, summary };
}
