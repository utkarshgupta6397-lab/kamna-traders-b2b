/**
 * Automated Test Suite for DCR Tag Import Parser
 * 
 * Verifies all parser unit test requirements from Section 5:
 * 1. Chain with Claimed: extract the entity immediately before it.
 * 2. Chain without Claimed: extract the last valid entity.
 * 3. The supplied Waaree example returns "Kamna Traders (461)".
 * 4. Remarks containing only an invalid-serial error return None (null).
 * 5. Missing or malformed chain returns None (null).
 * 6. Whitespace around delimiters is handled correctly.
 * 7. Parenthetical identifiers are preserved.
 * 8. Government reference numbers after Claimed are excluded.
 * 9. Normalization trims whitespace and preserves entity internal spaces.
 * 10. Only manufacturer before Claimed or in chain flags for review (None).
 * 11. Duplicate input rows retain latest-row-wins behavior.
 * 12. Malformed final duplicate preserves earlier valid occurrence.
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

  // --- UNIT TEST 1: Chain with Claimed: extract entity immediately before it ---
  const promptExample = "Mundra Solar Energy Limited -> Mittal Trading Company (192400009332) -> Kamna Traders (MT-UP/26-26/12) -> Shree Balaji Battery House (KT/26-27/1420.) -> Mrs.Kesho Devi (SBS-89) Claimed -> NP-UKPC26-11947631";
  const ext1 = extractSerialTag(promptExample);
  assert(ext1.tag === 'Mrs.Kesho Devi (SBS-89)', 'TEST 1a: Extracts Mrs.Kesho Devi (SBS-89)');
  assert(ext1.status === 'VALID', 'TEST 1b: Status is VALID');
  assert(ext1.rule === 'RULE_A_CHAIN_WITH_CLAIMED', 'TEST 1c: Rule is RULE_A_CHAIN_WITH_CLAIMED');

  // Another chain with Claimed
  const chainWithClaimed2 = "Vendor A -> Distributor B (123) -> Kamna Traders (461) -> Customer X (ABC) Claimed -> NP-UP123";
  const ext1b = extractSerialTag(chainWithClaimed2);
  assert(ext1b.tag === 'Customer X (ABC)', 'TEST 1d: Extracts Customer X (ABC)');
  assert(ext1b.status === 'VALID', 'TEST 1e: Status is VALID');

  // --- UNIT TEST 2: Chain without Claimed: extract the last valid entity ---
  const chainWithoutClaimed = "Mundra Solar Energy Limited -> Mittal Trading Company (192400009332) -> Shree Balaji Battery House (KT/26-27/1420.)";
  const ext2 = extractSerialTag(chainWithoutClaimed);
  assert(ext2.tag === 'Shree Balaji Battery House (KT/26-27/1420.)', 'TEST 2a: Extracts last valid entity when Claimed is absent');
  assert(ext2.status === 'VALID', 'TEST 2b: Status is VALID');
  assert(ext2.rule === 'RULE_B_CHAIN_WITHOUT_CLAIMED', 'TEST 2c: Rule is RULE_B_CHAIN_WITHOUT_CLAIMED');

  // --- UNIT TEST 3: The supplied Waaree example returns Kamna Traders (461) ---
  const waareeExample = "Waaree Energies Limited -> AMR Power Solutions (5601016510) -> Kamna Traders (461)";
  const ext3 = extractSerialTag(waareeExample);
  assert(ext3.tag === 'Kamna Traders (461)', 'TEST 3a: Waaree example extracts "Kamna Traders (461)"');
  assert(ext3.status === 'VALID', 'TEST 3b: Status is VALID');
  assert(ext3.rule === 'RULE_B_CHAIN_WITHOUT_CLAIMED', 'TEST 3c: Rule is RULE_B_CHAIN_WITHOUT_CLAIMED');

  // Multiline with stock error remark prefix and Waaree chain without Claimed
  const multilineWaaree = `WS08269076443811\tPanel is not in your stock (not claimed or already sold)
Waaree Energies Limited -> AMR Power Solutions (5601016510) -> Kamna Traders (461)`;
  const res3m = parseTabularRemarks(multilineWaaree);
  assert(res3m.length === 1, 'TEST 3d: Multiline Waaree parsed as 1 row');
  assert(res3m[0]?.extractedTag === 'Kamna Traders (461)', 'TEST 3e: Multiline Waaree extracts Kamna Traders (461)');
  assert(res3m[0]?.status === 'VALID', 'TEST 3f: Status is VALID');

  // --- UNIT TEST 4: Remarks containing only an invalid-serial error return None (null) ---
  const invalidRemarks = [
    "Invalid serial number (not manufactured or typographical error)",
    "invalid serial number (not manufactured or typographical error)",
    "Invalid serial number",
    "Invalid Serial Number"
  ];
  for (let i = 0; i < invalidRemarks.length; i++) {
    const ext = extractSerialTag(invalidRemarks[i]);
    assert(ext.tag === null, `TEST 4.${i + 1}a: Invalid serial error returns None (null)`);
    assert(ext.status === 'NEEDS_REVIEW', `TEST 4.${i + 1}b: Status is NEEDS_REVIEW`);
  }

  // --- UNIT TEST 5: Missing or malformed chain returns None (null) ---
  const malformedChains = [
    "",
    "   ",
    "Waaree Energies Limited -> ",
    "OnlyOneEntityWithoutArrow",
    "Panel is not in your stock (not claimed or already sold)",
    "Waaree Energies Limited -> Waaree Energies Limited" // only manufacturer
  ];
  for (let i = 0; i < malformedChains.length; i++) {
    const ext = extractSerialTag(malformedChains[i]);
    assert(ext.tag === null, `TEST 5.${i + 1}a: Malformed/missing chain returns None (null)`);
    assert(ext.status === 'NEEDS_REVIEW', `TEST 5.${i + 1}b: Status is NEEDS_REVIEW`);
  }

  // --- UNIT TEST 6: Whitespace around delimiters is handled correctly ---
  const extraSpacesChain = "  Waaree Energies Limited   ->    AMR Power Solutions (5601016510)   ->     Kamna Traders (461)   ";
  const ext6 = extractSerialTag(extraSpacesChain);
  assert(ext6.tag === 'Kamna Traders (461)', 'TEST 6a: Extra spaces around delimiters handled correctly');
  assert(ext6.status === 'VALID', 'TEST 6b: Status is VALID');

  // --- UNIT TEST 7: Parenthetical identifiers are preserved ---
  const complexCodes = "Mfr -> Mittal (111) -> Shree Balaji Battery House (KT/26-27/1420.) Claimed -> NP-12345";
  const ext7 = extractSerialTag(complexCodes);
  assert(ext7.tag === 'Shree Balaji Battery House (KT/26-27/1420.)', 'TEST 7a: Preserves dots, slashes, hyphens inside parentheses');

  const hyphenAndSlash = "Mfr -> Dealer (D-1) -> North-East Power Corp (NE/2026-27/A-999) Claimed -> GOVT-01";
  const ext7b = extractSerialTag(hyphenAndSlash);
  assert(ext7b.tag === 'North-East Power Corp (NE/2026-27/A-999)', 'TEST 7b: Preserves hyphens and slashes in entity name and code');

  // In chain without Claimed
  const noClaimWithCode = "Mfr -> North-East Power Corp (NE/2026-27/A-999)";
  const ext7c = extractSerialTag(noClaimWithCode);
  assert(ext7c.tag === 'North-East Power Corp (NE/2026-27/A-999)', 'TEST 7c: Preserves code in chain without Claimed');

  // --- UNIT TEST 8: Government reference numbers after Claimed are excluded ---
  const chainWithGovt = "Mfr -> Dealer (D-1) -> End User (EU-99) Claimed -> NP-UPPAV26-99999999";
  const ext8 = extractSerialTag(chainWithGovt);
  assert(ext8.tag === 'End User (EU-99)', 'TEST 8a: Extracts End User (EU-99)');
  assert(!ext8.tag?.includes('NP-UPPAV26'), 'TEST 8b: Government claim reference completely excluded');
  assert(!ext8.tag?.toLowerCase().includes('claimed'), 'TEST 8c: "Claimed" word excluded from tag');

  // --- UNIT TEST 9: Standalone Claimed segment ---
  const standaloneClaimed = "Mfr -> Intermediate (INT-1) -> Target Customer (TC-88) -> Claimed -> NP-GOVT-01";
  const ext9 = extractSerialTag(standaloneClaimed);
  assert(ext9.tag === 'Target Customer (TC-88)', 'TEST 9a: Extracts Target Customer (TC-88) when Claimed is separate segment');

  // --- UNIT TEST 10: Explicit "No Data" tag input ---
  const explicitNoData = extractSerialTag("No Data");
  assert(explicitNoData.tag === 'No Data', 'TEST 10a: Explicit "No Data" tag returned');
  assert(explicitNoData.status === 'VALID', 'TEST 10b: Explicit No Data status is VALID');

  // --- UNIT TEST 11: Duplicate Handling (Last Valid Occurrence Wins) ---
  const dupInput = `DUP_SER_01\tMfr -> First Vendor (V1)
DUP_SER_01\tMfr -> Winning Vendor (V2)`;
  const dupParsed = parseTabularRemarks(dupInput);
  const { resolvedRows: dupResolved, summary: dupSummary } = resolveDuplicates(dupParsed);
  assert(dupSummary.totalParsedRows === 2, 'TEST 11a: 2 parsed rows');
  assert(dupSummary.uniqueSerials === 1, 'TEST 11b: 1 unique serial');
  assert(dupSummary.skippedDuplicatesCount === 1, 'TEST 11c: 1 duplicate skipped');
  assert(dupResolved[0]?.isSelectedOccurrence === false, 'TEST 11d: Occurrence 1 skipped');
  assert(dupResolved[1]?.isSelectedOccurrence === true, 'TEST 11e: Occurrence 2 selected');
  assert(dupResolved[1]?.extractedTag === 'Winning Vendor (V2)', 'TEST 11f: Winning tag selected');

  // --- UNIT TEST 12: Malformed Final Duplicate Preserves Earlier Valid Occurrence ---
  const dupWithMalformedFinal = `DUP_SER_02\tMfr -> Earlier Valid (EV-1)
DUP_SER_02\tInvalid serial number (not manufactured or typographical error)`;
  const dupMResolved = resolveDuplicates(parseTabularRemarks(dupWithMalformedFinal)).resolvedRows;
  const winner = dupMResolved.find(r => r.isSelectedOccurrence);
  assert(winner?.rowNumber === 1, 'TEST 12a: Earlier valid occurrence preserved');
  assert(winner?.extractedTag === 'Earlier Valid (EV-1)', 'TEST 12b: Earlier tag preserved');

  console.log('\n======================================================');
  console.log(`PARSER TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runParserTests();
