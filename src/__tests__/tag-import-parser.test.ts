/**
 * Automated Test Suite for DCR Tag Import Parser
 * 
 * Verifies all parser test cases including:
 * 1. Prompt Example: extracts Mrs.Kesho Devi (SBS-89)
 * 2. Longer chain: extracts last entity immediately before Claimed
 * 3. Government claim reference after Claimed is excluded
 * 4. Parentheses, codes, hyphens, dots, slashes are preserved
 * 5. Missing Claimed marker flags for review (NEEDS_REVIEW)
 * 6. Invalid serial remark produces "No Data" (Rule A precedence)
 * 7. Multiline continuation rows with Claimed marker
 * 8. TSV with and without headers
 * 9. CRLF and LF line endings
 * 10. Blank lines and whitespace trimming
 * 11. Alphanumeric serials with leading zeros and hyphens preserved
 * 12. Only manufacturer before Claimed flags for review
 * 13. Duplicate handling: Last valid occurrence wins
 * 14. Malformed final duplicate preserves earlier valid occurrence
 */

import {
  parseTabularRemarks,
  extractSerialTag,
  resolveDuplicates,
  normalizeNewlines
} from '../lib/dcr/tag-import-parser';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${message || 'Assertion failed'}`);
    failed++;
  }
}

async function runParserTests() {
  console.log('\n======================================================');
  console.log('       DCR TAG IMPORT PARSER TEST SUITE               ');
  console.log('======================================================\n');

  // --- TEST 1: The Prompt's Exact Example ---
  const promptExample = "Mundra Solar Energy Limited -> Mittal Trading Company (192400009332) -> Kamna Traders (MT-UP/26-26/12) -> Shree Balaji Battery House (KT/26-27/1420.) -> Mrs.Kesho Devi (SBS-89) Claimed -> NP-UKPC26-11947631";
  const ext1 = extractSerialTag(promptExample);
  assert(ext1.tag === 'Mrs.Kesho Devi (SBS-89)', 'TEST 1a: Extracts Mrs.Kesho Devi (SBS-89)');
  assert(ext1.status === 'VALID', 'TEST 1b: Status is VALID');
  assert(ext1.rule === 'RULE_B_VENDOR_CHAIN', 'TEST 1c: Rule is RULE_B_VENDOR_CHAIN');

  // --- TEST 2: Real Production Multiline Vendor Chain ---
  const multilineReal = `MS2607281A3575\tPanel is not in your stock (not claimed or already sold)
Mundra Solar Energy Limited -> Mittal Trading Company (192400003846) -> Kamna Traders (67567431) -> Aakriti Solar Energies And Innovation (KT/26-27/2884,2880) -> Get Solar EPC India (AS/26-27/078) -> Mr. Jagdev Singh (GSEI/26-27/282) Claimed -> NP-UPPAV26-12677548`;
  const res2 = parseTabularRemarks(multilineReal);
  assert(res2.length === 1, 'TEST 2a: Multiline row parsed as single record');
  assert(res2[0]?.serialNumber === 'MS2607281A3575', 'TEST 2b: Correct serial extracted');
  assert(res2[0]?.extractedTag === 'Mr. Jagdev Singh (GSEI/26-27/282)', 'TEST 2c: Extracts last business before Claimed: Mr. Jagdev Singh (GSEI/26-27/282)');
  assert(res2[0]?.status === 'VALID', 'TEST 2d: Status is VALID');

  // --- TEST 3: Government Claim Reference Excluded ---
  const chainWithGovt = "Mfr -> Dealer (D-1) -> End User (EU-99) Claimed -> NP-UPPAV26-99999999";
  const ext3 = extractSerialTag(chainWithGovt);
  assert(ext3.tag === 'End User (EU-99)', 'TEST 3a: Extracts End User (EU-99)');
  assert(!ext3.tag?.includes('NP-UPPAV26'), 'TEST 3b: Government claim reference completely excluded');
  assert(!ext3.tag?.toLowerCase().includes('claimed'), 'TEST 3c: "Claimed" word excluded from tag');

  // --- TEST 4: Preservation of Parentheses, Codes, Slashes, Hyphens, and Dots ---
  const complexCodes = "Mfr -> Mittal (111) -> Shree Balaji Battery House (KT/26-27/1420.) Claimed -> NP-12345";
  const ext4 = extractSerialTag(complexCodes);
  assert(ext4.tag === 'Shree Balaji Battery House (KT/26-27/1420.)', 'TEST 4a: Preserves dots, slashes, hyphens inside parentheses');

  const hyphenAndSlash = "Mfr -> Dealer (D-1) -> North-East Power Corp (NE/2026-27/A-999) Claimed -> GOVT-01";
  const ext4b = extractSerialTag(hyphenAndSlash);
  assert(ext4b.tag === 'North-East Power Corp (NE/2026-27/A-999)', 'TEST 4b: Preserves hyphens and slashes in entity name and code');

  // --- TEST 5: Missing "Claimed" Marker Flags for Review ---
  const missingClaimed = "Waaree Energies Limited -> AMR Power Solutions (5601016510)";
  const ext5 = extractSerialTag(missingClaimed);
  assert(ext5.status === 'NEEDS_REVIEW', 'TEST 5a: Missing Claimed marker produces NEEDS_REVIEW');
  assert(ext5.tag === null, 'TEST 5b: No tag extracted when Claimed marker is absent');
  assert(Boolean(ext5.reason?.includes('Claimed')), 'TEST 5c: Reason mentions missing Claimed marker');

  // --- TEST 6: Invalid Serial Remarks Produce "No Data" (Rule A Precedence) ---
  const invalidRemarks = [
    "Invalid serial number (not manufactured or typographical error)",
    "invalid serial number (not manufactured or typographical error)",
    "Invalid serial number",
    "Invalid serial number -> Mrs.Kesho Devi (SBS-89) Claimed -> NP-01" // Rule A takes precedence
  ];
  for (let i = 0; i < invalidRemarks.length; i++) {
    const ext = extractSerialTag(invalidRemarks[i]);
    assert(ext.tag === 'No Data', `TEST 6.${i + 1}a: Invalid serial produces "No Data"`);
    assert(ext.rule === 'RULE_A_INVALID_SERIAL', `TEST 6.${i + 1}b: Rule A applied`);
    assert(ext.status === 'VALID', `TEST 6.${i + 1}c: Status is VALID`);
  }

  // --- TEST 7: Claimed as Standalone Segment ---
  const standaloneClaimed = "Mfr -> Intermediate (INT-1) -> Target Customer (TC-88) -> Claimed -> NP-GOVT-01";
  const ext7 = extractSerialTag(standaloneClaimed);
  assert(ext7.tag === 'Target Customer (TC-88)', 'TEST 7a: Extracts Target Customer (TC-88) when Claimed is separate segment');

  // --- TEST 8: Only Manufacturer Before Claimed Flags for Review ---
  const onlyMfr = "Mundra Solar Energy Limited Claimed -> NP-UKPC26-11947631";
  const ext8 = extractSerialTag(onlyMfr);
  assert(ext8.status === 'NEEDS_REVIEW', 'TEST 8a: Only manufacturer before Claimed flags for review');
  assert(ext8.tag === null, 'TEST 8b: Manufacturer is never extracted as a tag');

  // --- TEST 9: TSV with Header and Multiple Rows ---
  const tsvWithHeader = `Serial Number\tError Remarks
SER001\tMfr -> Dealer (D1) -> Customer A (CA-1) Claimed -> NP-001
SER002\tInvalid serial number
SER003\tMfr -> Dealer (D1) -> Other Entity (OE-1)`;
  const res9 = parseTabularRemarks(tsvWithHeader);
  assert(res9.length === 3, 'TEST 9a: Header excluded, 3 rows parsed');
  assert(res9[0]?.extractedTag === 'Customer A (CA-1)', 'TEST 9b: Row 1 tag matches');
  assert(res9[1]?.extractedTag === 'No Data', 'TEST 9c: Row 2 tag is No Data');
  assert(res9[2]?.status === 'NEEDS_REVIEW', 'TEST 9d: Row 3 is NEEDS_REVIEW');

  // --- TEST 10: CRLF and LF Handling ---
  const crlfInput = "S1\tMfr -> C1 (01) Claimed -> G1\r\nS2\tMfr -> C2 (02) Claimed -> G2\nS3\tInvalid serial number\r\n";
  const res10 = parseTabularRemarks(crlfInput);
  assert(res10.length === 3, 'TEST 10a: Mixed CRLF and LF handled');
  assert(res10[0]?.extractedTag === 'C1 (01)' && res10[1]?.extractedTag === 'C2 (02)', 'TEST 10b: Tags extracted correctly');

  // --- TEST 11: Whitespace Trimming ---
  const whitespaceInput = "  WS08269076443811  \t  Mfr ->  AMR Solutions (560) Claimed -> NP-1  ";
  const res11 = parseTabularRemarks(whitespaceInput);
  assert(res11[0]?.serialNumber === 'WS08269076443811', 'TEST 11a: Serial whitespace trimmed');
  assert(res11[0]?.extractedTag === 'AMR Solutions (560)', 'TEST 11b: Tag whitespace trimmed');

  // --- TEST 12: Alphanumeric and Hyphenated Serials ---
  const alphaHyphen = "007ABC-XYZ-99\tMfr -> Customer (C-99) Claimed -> NP-01";
  const res12 = parseTabularRemarks(alphaHyphen);
  assert(res12[0]?.serialNumber === '007ABC-XYZ-99', 'TEST 12a: Alphanumeric with leading zero and hyphens preserved');

  // --- TEST 13: Duplicate Handling (Last Valid Occurrence Wins) ---
  const dupInput = `DUP_SER_01\tMfr -> First Vendor (V1) Claimed -> NP-01
DUP_SER_01\tMfr -> Winning Vendor (V2) Claimed -> NP-02`;
  const dupParsed = parseTabularRemarks(dupInput);
  const { resolvedRows: dupResolved, summary: dupSummary } = resolveDuplicates(dupParsed);
  assert(dupSummary.totalParsedRows === 2, 'TEST 13a: 2 parsed rows');
  assert(dupSummary.uniqueSerials === 1, 'TEST 13b: 1 unique serial');
  assert(dupSummary.skippedDuplicatesCount === 1, 'TEST 13c: 1 duplicate skipped');
  assert(dupResolved[0]?.isSelectedOccurrence === false, 'TEST 13d: Occurrence 1 skipped');
  assert(dupResolved[1]?.isSelectedOccurrence === true, 'TEST 13e: Occurrence 2 selected');
  assert(dupResolved[1]?.extractedTag === 'Winning Vendor (V2)', 'TEST 13f: Winning tag selected');

  // --- TEST 14: Malformed Final Duplicate Preserves Earlier Valid Occurrence ---
  const dupWithMalformedFinal = `DUP_SER_02\tMfr -> Earlier Valid (EV-1) Claimed -> NP-01
DUP_SER_02\tOnlyManufacturer -> `;
  const dupMResolved = resolveDuplicates(parseTabularRemarks(dupWithMalformedFinal)).resolvedRows;
  const winner = dupMResolved.find(r => r.isSelectedOccurrence);
  assert(winner?.rowNumber === 1, 'TEST 14a: Earlier valid occurrence preserved');
  assert(winner?.extractedTag === 'Earlier Valid (EV-1)', 'TEST 14b: Earlier tag preserved');

  console.log('\n======================================================');
  console.log(`PARSER TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runParserTests();
