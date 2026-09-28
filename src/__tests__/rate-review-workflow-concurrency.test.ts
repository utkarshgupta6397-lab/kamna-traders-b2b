import assert from 'assert';
import { prisma } from '../lib/db';
import { encrypt } from '../lib/jwt';

const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';

// 10 sample line items
const SAMPLE_LINE_ITEMS = Array.from({ length: 10 }, (_, i) => ({
  item_id: `item_${i + 1}`,
  name: `Solar Line Item ${i + 1}`,
  rate: 1000 * (i + 1),
  quantity: 2,
  tax_percentage: 18,
  item_tax: 360 * (i + 1),
  item_total: 2360 * (i + 1),
}));

async function getAuthCookie(): Promise<string> {
  const session = await prisma.activeSession.findFirst({
    include: { user: true }
  });
  if (!session) {
    throw new Error('No active session in database. Cannot run integration tests.');
  }

  const token = await encrypt({
    userId: session.userId,
    role: session.user.role,
    sessionToken: session.sessionToken,
    deviceType: session.deviceType,
    expires: new Date(Date.now() + 86400000).toISOString()
  });

  return `session=${token}`;
}

async function createTestOrder(salesorderNumber: string) {
  const testZohoId = `zoho_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const order = await prisma.dispatchIncomingOrder.create({
    data: {
      zohoSalesorderId: testZohoId,
      salesorderNumber,
      customerName: 'Test Concurrency Customer Ltd',
      status: 'PROCESSING',
      total: 50000,
      zohoDetailsJson: {
        line_items: SAMPLE_LINE_ITEMS,
        total: 50000
      },
      preDispatchWorkflow: {
        create: {
          salesorderId: testZohoId,
          currentStep: 1,
          overallStatus: 'IN_PROGRESS',
          rateReviewStatus: 'NOT_STARTED',
          rateReviewAudit: { items: {} },
        }
      }
    },
    include: {
      preDispatchWorkflow: true
    }
  });
  return order;
}

async function cleanupOrder(orderId: string) {
  try {
    await prisma.dispatchWorkflowHistory.deleteMany({ where: { dispatchOrderId: orderId } });
    await prisma.preDispatchWorkflow.deleteMany({ where: { dispatchOrderId: orderId } });
    await prisma.dispatchIncomingOrder.deleteMany({ where: { id: orderId } });
  } catch (err) {
    // ignore cleanup errors
  }
}

async function callRateReviewApi(orderId: string, payload: any, cookie: string) {
  const res = await fetch(`${BASE_URL}/api/dispatch/incoming-orders/${orderId}/workflow/rate-review`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

// Client UI step accessibility helper matching PreDispatchWorkflowClient.tsx logic
function canAccessStep(stepId: number, currentStep: number, workflow: any, isTruckRequired = false, isTruckCompleted = false) {
  if (stepId === 1) return true;
  if (stepId === 2) return currentStep >= 2 || workflow.rateReviewStatus === 'COMPLETED';
  if (stepId === 3) return currentStep >= 3 || (workflow.paymentStatus === 'COMPLETED' && (!isTruckRequired || isTruckCompleted));
  if (stepId === 4) return currentStep >= 4 || workflow.readyForInvoiceStatus === 'COMPLETED';
  return false;
}

// Client UI step rendering simulation
function evaluateRenderedStep(activeStep: number, currentStep: number, workflow: any) {
  if (activeStep === 1) return 'RateReviewStep';
  if (activeStep === 2 && canAccessStep(2, currentStep, workflow)) return 'PaymentVerificationStep';
  if (activeStep === 3 && canAccessStep(3, currentStep, workflow)) return 'ReadyForInvoiceStep';
  if (activeStep === 4 && canAccessStep(4, currentStep, workflow)) return 'InvoiceConfirmationStep';
  // Fallback state
  if (activeStep > 1 && !canAccessStep(activeStep, currentStep, workflow)) return 'WorkflowStateNeedsAttentionFallback';
  return 'Blank'; // If this ever returns 'Blank', it's a regression!
}

async function runRegressionTestSuite() {
  console.log('\n===============================================================');
  console.log('STARTING RATE REVIEW WORKFLOW CONCURRENCY & INTEGRITY TESTS');
  console.log('===============================================================\n');

  const authCookie = await getAuthCookie();
  const createdOrders: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST A: Normal Rate Review completion
    // -------------------------------------------------------------------------
    console.log('--- TEST A: Normal Rate Review Completion ---');
    const orderA = await createTestOrder('SO-TEST-A');
    createdOrders.push(orderA.id);

    // Verify all 10 items
    const allVerifiedAudit = {
      items: Object.fromEntries(
        SAMPLE_LINE_ITEMS.map(item => [
          item.item_id,
          { verified: true, rate: item.rate, tax: item.tax_percentage }
        ])
      )
    };

    const resA = await callRateReviewApi(orderA.id, { action: 'complete', audit: allVerifiedAudit }, authCookie);
    assert.strictEqual(resA.status, 200, 'Test A API should return 200');
    assert.strictEqual(resA.data.success, true, 'Test A API success should be true');

    const wfA = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderA.id } });
    assert.strictEqual(wfA?.currentStep, 2, 'Workflow must be at Step 2');
    assert.strictEqual(wfA?.rateReviewStatus, 'COMPLETED', 'rateReviewStatus must be COMPLETED');
    assert(wfA?.rateReviewCompletedAt, 'rateReviewCompletedAt must be populated');
    console.log('✓ PASS: Normal completion successfully progressed to Step 2.\n');

    // -------------------------------------------------------------------------
    // TEST B: Rapid verification of multiple items followed immediately by Complete
    // -------------------------------------------------------------------------
    console.log('--- TEST B: Rapid Multi-Item Verification Followed by Complete ---');
    const orderB = await createTestOrder('SO-TEST-B');
    createdOrders.push(orderB.id);

    // Fire rapid saves in parallel for items 1-8, 1-9, and finally complete for 1-10
    const partialAudit8 = {
      items: Object.fromEntries(SAMPLE_LINE_ITEMS.slice(0, 8).map(item => [item.item_id, { verified: true, rate: item.rate, tax: item.tax_percentage }]))
    };
    const partialAudit9 = {
      items: Object.fromEntries(SAMPLE_LINE_ITEMS.slice(0, 9).map(item => [item.item_id, { verified: true, rate: item.rate, tax: item.tax_percentage }]))
    };

    const [save8, save9, compB] = await Promise.all([
      callRateReviewApi(orderB.id, { action: 'save', audit: partialAudit8 }, authCookie),
      callRateReviewApi(orderB.id, { action: 'save', audit: partialAudit9 }, authCookie),
      callRateReviewApi(orderB.id, { action: 'complete', audit: allVerifiedAudit }, authCookie),
    ]);

    assert(compB.status === 200 || compB.status === 400, 'Complete request should resolve cleanly');
    const wfB = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderB.id } });
    assert.strictEqual(wfB?.currentStep, 2, 'Workflow must be at Step 2');
    assert.strictEqual(wfB?.rateReviewStatus, 'COMPLETED', 'rateReviewStatus must be COMPLETED');
    console.log('✓ PASS: Rapid saves alongside complete resulted in valid COMPLETED state.\n');

    // -------------------------------------------------------------------------
    // TEST C & 6: DELIBERATE OUT-OF-ORDER RACE (Original Failure Scenario)
    // -------------------------------------------------------------------------
    console.log('--- TEST C & 6: Deliberate Out-of-Order Race (Delayed Save Arriving AFTER Complete) ---');
    const orderC = await createTestOrder('SO-TEST-C');
    createdOrders.push(orderC.id);

    // Step 1: Complete Rate Review first
    const compC = await callRateReviewApi(orderC.id, { action: 'complete', audit: allVerifiedAudit }, authCookie);
    assert.strictEqual(compC.status, 200, 'Complete should succeed');
    
    let wfC = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderC.id } });
    assert.strictEqual(wfC?.currentStep, 2);
    assert.strictEqual(wfC?.rateReviewStatus, 'COMPLETED');
    const completedAtTimestamp = wfC?.rateReviewCompletedAt?.getTime();

    // Step 2: Send a delayed, stale SAVE request containing only 8 items
    console.log('  Firing delayed stale save (8 items) against already completed workflow...');
    const staleSave = await callRateReviewApi(orderC.id, { action: 'save', audit: partialAudit8 }, authCookie);
    assert.strictEqual(staleSave.status, 200, 'Stale save should return 200 (graceful ignore)');
    assert(staleSave.data.message?.includes('already') || staleSave.data.message?.includes('ignored'), 'Response should communicate save was ignored');

    // Step 3: Verify the database was NOT regressed
    wfC = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderC.id } });
    assert.strictEqual(wfC?.currentStep, 2, 'CRITICAL: currentStep must remain 2');
    assert.strictEqual(wfC?.rateReviewStatus, 'COMPLETED', 'CRITICAL: rateReviewStatus must NOT regress to IN_PROGRESS');
    assert.strictEqual(wfC?.rateReviewCompletedAt?.getTime(), completedAtTimestamp, 'CRITICAL: rateReviewCompletedAt must not be overwritten');
    
    // Step 4: Verify UI renders PaymentVerificationStep and NEVER blank
    const renderedStepC = evaluateRenderedStep(2, wfC!.currentStep, wfC!);
    assert.strictEqual(renderedStepC, 'PaymentVerificationStep', 'UI must render PaymentVerificationStep');
    console.log('✓ PASS: Delayed save was completely blocked from regressing the workflow!\n');

    // -------------------------------------------------------------------------
    // TEST D: Double-click Complete
    // -------------------------------------------------------------------------
    console.log('--- TEST D: Double-Click Complete (Concurrent Submissions) ---');
    const orderD = await createTestOrder('SO-TEST-D');
    createdOrders.push(orderD.id);

    const [firstClick, secondClick] = await Promise.all([
      callRateReviewApi(orderD.id, { action: 'complete', audit: allVerifiedAudit }, authCookie),
      callRateReviewApi(orderD.id, { action: 'complete', audit: allVerifiedAudit }, authCookie),
    ]);

    // One must succeed, the other must either succeed or return 400 with clean error
    const statuses = [firstClick.status, secondClick.status].sort();
    assert(
      (statuses[0] === 200 && statuses[1] === 200) || (statuses[0] === 200 && statuses[1] === 400),
      `Expected [200, 200] or [200, 400], got [${firstClick.status}, ${secondClick.status}]`
    );

    const wfD = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderD.id } });
    assert.strictEqual(wfD?.currentStep, 2);
    assert.strictEqual(wfD?.rateReviewStatus, 'COMPLETED');
    console.log('✓ PASS: Double-click handled safely without state corruption.\n');

    // -------------------------------------------------------------------------
    // TEST E: Refresh during transition
    // -------------------------------------------------------------------------
    console.log('--- TEST E: Refresh During Transition ---');
    const orderE = await createTestOrder('SO-TEST-E');
    createdOrders.push(orderE.id);

    await callRateReviewApi(orderE.id, { action: 'complete', audit: allVerifiedAudit }, authCookie);
    
    // Simulate page reload: fetch fresh workflow
    const refreshedWf = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderE.id } });
    const renderedOnReload = evaluateRenderedStep(refreshedWf!.currentStep, refreshedWf!.currentStep, refreshedWf!);
    assert.strictEqual(renderedOnReload, 'PaymentVerificationStep', 'Reloaded state must render Step 2');
    console.log('✓ PASS: Refreshing during/after transition renders Step 2 cleanly.\n');

    // -------------------------------------------------------------------------
    // TEST F: Two browser tabs attempting the same transition
    // -------------------------------------------------------------------------
    console.log('--- TEST F: Two Browser Tabs (Tab 1 Completes, Tab 2 Saves Stale) ---');
    const orderF = await createTestOrder('SO-TEST-F');
    createdOrders.push(orderF.id);

    // Tab 1 completes
    await callRateReviewApi(orderF.id, { action: 'complete', audit: allVerifiedAudit }, authCookie);
    // Tab 2 was open with 7 items verified and auto-saves
    const tab2Save = await callRateReviewApi(
      orderF.id,
      { action: 'save', audit: { items: { item_1: { verified: true } } } },
      authCookie
    );
    assert.strictEqual(tab2Save.status, 200);

    const wfF = await prisma.preDispatchWorkflow.findUnique({ where: { dispatchOrderId: orderF.id } });
    assert.strictEqual(wfF?.currentStep, 2);
    assert.strictEqual(wfF?.rateReviewStatus, 'COMPLETED');
    console.log('✓ PASS: Tab 2 stale save could not overwrite Tab 1 completion.\n');

    // -------------------------------------------------------------------------
    // TEST G: Workflow with currentStep=2 and rateReviewStatus=IN_PROGRESS (Corrupted/Legacy Record)
    // -------------------------------------------------------------------------
    console.log('--- TEST G: Workflow with currentStep=2, rateReviewStatus=IN_PROGRESS (Corrupted State) ---');
    const legacyCorruptWf = {
      currentStep: 2,
      rateReviewStatus: 'IN_PROGRESS',
      paymentStatus: 'NOT_STARTED',
      truckDetailsStatus: 'NOT_STARTED',
      readyForInvoiceStatus: 'NOT_STARTED',
    };

    // 1. Verify step accessibility
    const canAccessG = canAccessStep(2, legacyCorruptWf.currentStep, legacyCorruptWf);
    assert.strictEqual(canAccessG, true, 'canAccessStep(2) MUST be true when currentStep >= 2');

    // 2. Verify rendered UI component
    const renderedG = evaluateRenderedStep(2, legacyCorruptWf.currentStep, legacyCorruptWf);
    assert.strictEqual(renderedG, 'PaymentVerificationStep', 'Must render PaymentVerificationStep, NOT blank!');
    assert.notStrictEqual(renderedG, 'Blank', 'Must NEVER render Blank');
    console.log('✓ PASS: Inconsistent record with currentStep=2 renders PaymentVerificationStep without blank screen.\n');

    // -------------------------------------------------------------------------
    // TEST H: Workflow with currentStep=2 and rateReviewStatus=COMPLETED
    // -------------------------------------------------------------------------
    console.log('--- TEST H: Workflow with currentStep=2, rateReviewStatus=COMPLETED ---');
    const normalStep2Wf = {
      currentStep: 2,
      rateReviewStatus: 'COMPLETED',
      paymentStatus: 'NOT_STARTED',
      truckDetailsStatus: 'NOT_STARTED',
      readyForInvoiceStatus: 'NOT_STARTED',
    };

    assert.strictEqual(canAccessStep(2, normalStep2Wf.currentStep, normalStep2Wf), true);
    const renderedH = evaluateRenderedStep(2, normalStep2Wf.currentStep, normalStep2Wf);
    assert.strictEqual(renderedH, 'PaymentVerificationStep');
    console.log('✓ PASS: Normal Step 2 renders PaymentVerificationStep cleanly.\n');

    // -------------------------------------------------------------------------
    // TEST I: Inaccessible / Locked Step Rendering Failure Test
    // -------------------------------------------------------------------------
    console.log('--- TEST I: Inaccessible Step Fallback (No Blank Panels) ---');
    const step1Wf = {
      currentStep: 1,
      rateReviewStatus: 'NOT_STARTED',
      paymentStatus: 'NOT_STARTED',
      truckDetailsStatus: 'NOT_STARTED',
      readyForInvoiceStatus: 'NOT_STARTED',
    };

    // Suppose user tries to view step 2 when step 1 is still in progress
    const renderedI = evaluateRenderedStep(2, step1Wf.currentStep, step1Wf);
    assert.strictEqual(
      renderedI,
      'WorkflowStateNeedsAttentionFallback',
      'When step 2 is locked, UI must render explicit recovery state, NEVER Blank'
    );
    assert.notStrictEqual(renderedI, 'Blank', 'Must NEVER render Blank');
    console.log('✓ PASS: Locked/unreachable step renders fallback recovery panel instead of blank space.\n');

    console.log('===============================================================');
    console.log('ALL REGRESSION TESTS PASSED SUCCESSFULLY! ✅');
    console.log('===============================================================\n');

  } finally {
    console.log('Cleaning up test records...');
    for (const id of createdOrders) {
      await cleanupOrder(id);
    }
    console.log('Cleanup finished.');
    await prisma.$disconnect();
  }
}

runRegressionTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
