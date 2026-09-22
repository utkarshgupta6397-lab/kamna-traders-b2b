import assert from 'assert';
import { prisma } from '../lib/db';
import { isConsumerCustomer } from '../lib/post-dispatch-sync';
import { buildPostDispatchWhereClause } from '../lib/post-dispatch-query';

async function runEInvoiceFilterTests() {
  console.log('====================================================');
  console.log('POST-DISPATCH E-INVOICE FILTER & ELIGIBILITY TEST SUITE');
  console.log('====================================================\n');

  console.log('--- TEST 1: isConsumerCustomer Authoritative Eligibility ---');
  // 1.1 Consumer treatment
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'consumer' }), true, 'T1.1: consumer -> true');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'Consumer' }), true, 'T1.2: Consumer (capitalized) -> true');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: '  consumer  ' }), true, 'T1.3: whitespace trimmed -> true');

  // 1.2 Unregistered treatment
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'unregistered' }), true, 'T1.4: unregistered -> true');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'Unregistered' }), true, 'T1.5: Unregistered -> true');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'unregistered_business' }), true, 'T1.6: unregistered_business -> true');

  // 1.3 B2B Registered treatments
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'business_regular' }), false, 'T1.7: business_regular -> false');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'business_composition' }), false, 'T1.8: business_composition -> false');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: 'business_gst' }), false, 'T1.9: business_gst -> false');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: null }), false, 'T1.10: null -> false');
  assert.strictEqual(isConsumerCustomer({ gstTreatment: undefined }), false, 'T1.11: undefined -> false');

  // 1.4 Valid GSTIN override
  assert.strictEqual(
    isConsumerCustomer({ gstTreatment: 'consumer', gstNumber: '07AAAAA1111A1Z1' }),
    false,
    'T1.12: Valid GSTIN overrides consumer treatment'
  );
  assert.strictEqual(
    isConsumerCustomer({ gstTreatment: 'consumer', gstNumber: 'NOT_AVAILABLE' }),
    true,
    'T1.13: NOT_AVAILABLE GSTIN does not override consumer treatment'
  );

  console.log('  ✓ PASS: All isConsumerCustomer eligibility checks passed\n');

  console.log('--- TEST 2: buildPostDispatchWhereClause tab normalization & structure ---');
  const whereEinvoice = buildPostDispatchWhereClause({ tab: 'einvoice_pending' });
  const whereEInvoiceUnderscore = buildPostDispatchWhereClause({ tab: 'e_invoice_pending' });

  // 2.1 Both URL tab keys generate identical query structure
  assert.strictEqual(whereEinvoice.erpStatus, 'Active', 'T2.1: erpStatus is Active');
  assert.strictEqual(whereEinvoice.eInvoiceGenerated, false, 'T2.2: eInvoiceGenerated is false');
  assert.deepStrictEqual(
    whereEinvoice.zohoStatus,
    { notIn: ['void', 'draft'] },
    'T2.3: zohoStatus excludes void and draft'
  );
  assert.deepStrictEqual(
    whereEinvoice,
    whereEInvoiceUnderscore,
    'T2.4: tab=einvoice_pending and tab=e_invoice_pending produce identical where clauses'
  );

  // 2.2 Verify presence of consumer exclusion in where.AND
  const andClauses = whereEinvoice.AND as any[];
  assert(Array.isArray(andClauses), 'T2.5: where.AND is an array');
  const hasConsumerExclusion = andClauses.some((clause) => {
    return clause.OR && clause.OR.some((branch: any) => branch.zohoDetailsJson?.path?.[0] === 'gst_treatment');
  });
  assert(hasConsumerExclusion, 'T2.6: Consumer exclusion on zohoDetailsJson is present in where.AND');
  console.log('  ✓ PASS: Tab normalization and query structure verified\n');

  console.log('--- TEST 3: Database Query Verification ---');
  // 3.1 Count einvoice_pending in DB
  const einvoiceCount = await prisma.postDispatchInvoice.count({ where: whereEinvoice });
  const underscoreCount = await prisma.postDispatchInvoice.count({ where: whereEInvoiceUnderscore });
  assert.strictEqual(einvoiceCount, underscoreCount, 'T3.1: DB count is identical for both tab parameters');
  console.log(`  ✓ Count for einvoice_pending: ${einvoiceCount} (identical for e_invoice_pending: ${underscoreCount})`);

  // 3.2 Fetch all matching invoices and assert NONE are consumer or unregistered
  const invoices = await prisma.postDispatchInvoice.findMany({
    where: whereEinvoice,
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      zohoDetailsJson: true,
    },
  });

  for (const inv of invoices) {
    const dj = inv.zohoDetailsJson as any;
    const treatment = (dj?.gst_treatment || '').toLowerCase().trim();
    assert(
      !treatment.includes('consumer'),
      `T3.2: Invoice ${inv.invoiceNumber} must NOT have consumer treatment (found: ${treatment})`
    );
    assert(
      !treatment.includes('unregistered'),
      `T3.3: Invoice ${inv.invoiceNumber} must NOT have unregistered treatment (found: ${treatment})`
    );
  }
  console.log(`  ✓ PASS: Zero of ${invoices.length} returned invoices have consumer or unregistered treatment\n`);

  // 3.3 Verify known consumer invoice KT/26-27/3050 is NOT matched
  const check3050 = await prisma.postDispatchInvoice.findFirst({
    where: {
      invoiceNumber: 'KT/26-27/3050',
      AND: whereEinvoice.AND,
    },
  });
  assert.strictEqual(check3050, null, 'T3.4: KT/26-27/3050 (consumer) is excluded by einvoice_pending where clause');
  console.log('  ✓ PASS: Known consumer invoice KT/26-27/3050 is strictly excluded');

  console.log('\n====================================================');
  console.log('ALL POST-DISPATCH E-INVOICE FILTER TESTS PASSED');
  console.log('====================================================');
}

runEInvoiceFilterTests()
  .catch((err) => {
    console.error('Test failure:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
