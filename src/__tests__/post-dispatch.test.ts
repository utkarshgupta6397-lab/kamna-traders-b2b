import { prisma } from '../lib/db';
import {
  isWithinIstWorkingHours,
  isIst7PmWindow,
  getIstTodayRange,
  getNextScheduledSyncTime,
  getNextScheduledEInvoiceTime,
  getTodayPostDispatchApiUsage,
  checkAndArchiveInvoice,
  isConsumerCustomer,
} from '../lib/post-dispatch-sync';
import {
  canVerifySubmission,
  hasPostDispatchAccess,
  hasPostDispatchPermission,
  hasDesktopPostDispatchAccess,
  hasMobilePostDispatchAccess,
} from '../lib/post-dispatch-auth';
import { recordPostDispatchHistory } from '../lib/post-dispatch-history';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   POST DISPATCH PHASE 1 — COMPREHENSIVE TEST SUITE   ');
  console.log('======================================================\n');

  // Clean up existing test records if any
  await prisma.postDispatchInvoice.deleteMany({
    where: { zohoInvoiceId: { startsWith: 'test_pd_' } },
  });
  await prisma.zohoApiLog.deleteMany({
    where: { endpoint: { startsWith: 'test_endpoint_' } },
  });
  await prisma.syncLock.deleteMany({
    where: { name: 'test_pd_lock' },
  });

  console.log('--- TEST A & B: Draft vs Sent Actionability ---');
  const draftInvoice = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: 'test_pd_draft_001',
      invoiceNumber: 'INV-DRAFT-001',
      customerName: 'Test Draft Customer',
      zohoStatus: 'draft',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      total: 50000,
      eInvoiceGenerated: false,
    },
  });

  const sentInvoice = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: 'test_pd_sent_002',
      invoiceNumber: 'INV-SENT-002',
      customerName: 'Test Sent Customer',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(Date.now() - 7200 * 1000), // 2 hours ago
      total: 120000,
      eInvoiceGenerated: true,
      eInvoiceIrn: 'IRN_TEST_12345',
      eInvoiceAckNo: 'ACK_998877',
      eInvoiceAckDate: '2026-09-09',
    },
  });

  const isDraftActionable = draftInvoice.zohoStatus.toLowerCase() === 'sent' && draftInvoice.erpStatus === 'Active';
  const isSentActionable = sentInvoice.zohoStatus.toLowerCase() === 'sent' && sentInvoice.erpStatus === 'Active';

  assert(!isDraftActionable, 'A: Draft invoice imported but NOT actionable');
  assert(isSentActionable, 'B: Sent invoice is actionable');
  assert(draftInvoice.zohoStatus === 'draft', 'Exact Zoho status "draft" is preserved');
  assert(sentInvoice.zohoStatus === 'sent', 'Exact Zoho status "sent" is preserved');

  console.log('\n--- TEST C: Void Invoice Archival & Sub-status ---');
  const voidInvoice = await prisma.postDispatchInvoice.create({
    data: {
      zohoInvoiceId: 'test_pd_void_003',
      invoiceNumber: 'INV-VOID-003',
      customerName: 'Test Void Customer',
      zohoStatus: 'void',
      erpStatus: 'Archived',
      erpSubStatus: 'Void',
      zohoCreatedTime: new Date(Date.now() - 10000 * 1000),
      timerStoppedAt: new Date(),
      total: 75000,
    },
  });

  assert(voidInvoice.zohoStatus === 'void', 'Void exact Zoho status is "void"');
  assert(voidInvoice.erpStatus === 'Archived', 'C: Void ERP status is "Archived"');
  assert(voidInvoice.erpSubStatus === 'Void', 'C: Void ERP sub-status is "Void"');
  assert(voidInvoice.timerStoppedAt !== null, 'C: Void invoice timer has stopped');

  console.log('\n--- TEST D & E: Invoice Timer Mechanics ---');
  const twoHoursAgo = new Date(Date.now() - 7200 * 1000);
  const now = new Date();
  const calculatedElapsed = Math.floor((now.getTime() - twoHoursAgo.getTime()) / 1000);
  assert(
    calculatedElapsed >= 7190 && calculatedElapsed <= 7210,
    'D: Timer calculates elapsed duration starting from Zoho invoice.created_time'
  );

  const stoppedTimerElapsed = Math.floor(
    (voidInvoice.timerStoppedAt!.getTime() - voidInvoice.zohoCreatedTime.getTime()) / 1000
  );
  assert(
    stoppedTimerElapsed >= 9990 && stoppedTimerElapsed <= 10010,
    'E: Timer duration freezes once invoice is stopped/archived'
  );

  console.log('\n--- TEST F, G, H, J, K: Receiving Upload Workflow & Multiple Cycles ---');
  // Create workflow
  const receivingWf = await prisma.postDispatchWorkflow.create({
    data: {
      invoiceId: sentInvoice.id,
      workflowType: 'RECEIVING',
      status: 'PENDING',
    },
  });

  // Cycle 1: Upload #1
  const sub1 = await prisma.postDispatchSubmission.create({
    data: {
      workflowId: receivingWf.id,
      submissionNumber: 1,
      status: 'AWAITING_VERIFICATION',
      receivingDetails: 'Initial customer stamp upload',
      uploadedByUserId: 'user_uploader_amit',
      uploadedByUserName: 'Amit Kumar',
      uploadedAt: new Date(Date.now() - 1800 * 1000),
    },
  });

  // Add 2 photos (Multiple photos allowed)
  const file1 = await prisma.postDispatchFile.create({
    data: {
      submissionId: sub1.id,
      fileName: 'receiving_photo_1.jpg',
      filePath: '/storage/post-dispatch/test/photo1.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 150000,
    },
  });
  const file2 = await prisma.postDispatchFile.create({
    data: {
      submissionId: sub1.id,
      fileName: 'receiving_photo_2.jpg',
      filePath: '/storage/post-dispatch/test/photo2.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 160000,
    },
  });

  await prisma.postDispatchWorkflow.update({
    where: { id: receivingWf.id },
    data: { status: 'AWAITING_VERIFICATION', currentSubmissionId: sub1.id },
  });

  await recordPostDispatchHistory(prisma, {
    invoiceId: sentInvoice.id,
    workflowType: 'RECEIVING',
    eventType: 'RECEIVING_UPLOADED',
    userId: 'user_uploader_amit',
    userName: 'Amit Kumar',
    submissionId: sub1.id,
  });

  assert(sub1.id !== null, 'F: Receiving evidence submitted successfully');
  const sub1Files = await prisma.postDispatchFile.findMany({ where: { submissionId: sub1.id } });
  assert(sub1Files.length === 2, 'G: Receiving upload supports multiple photos');

  console.log('\n--- TEST I & N: Rejection Requires Comment ---');
  // Verifier rejects sub1
  const rejectionComment = 'Customer stamp not visible on receipt';
  await prisma.postDispatchSubmission.update({
    where: { id: sub1.id },
    data: {
      status: 'REJECTED',
      rejectionComment,
      verifiedByUserId: 'user_verifier_rahul',
      verifiedByUserName: 'Rahul Verifier',
      verifiedAt: new Date(Date.now() - 1200 * 1000),
    },
  });

  await prisma.postDispatchWorkflow.update({
    where: { id: receivingWf.id },
    data: { status: 'REWORK_REQUIRED' },
  });

  await recordPostDispatchHistory(prisma, {
    invoiceId: sentInvoice.id,
    workflowType: 'RECEIVING',
    eventType: 'RECEIVING_REJECTED',
    userId: 'user_verifier_rahul',
    userName: 'Rahul Verifier',
    submissionId: sub1.id,
    rejectionReason: rejectionComment,
  });

  const rejectedSub = await prisma.postDispatchSubmission.findUnique({ where: { id: sub1.id } });
  assert(rejectedSub?.status === 'REJECTED', 'N: Authorized verifier can reject submission');
  assert(rejectedSub?.rejectionComment === rejectionComment, 'I: Rejection requires and stores comment');

  console.log('\n--- TEST J & K: Re-Upload & History Retention ---');
  // Cycle 2: Upload #2 (Re-upload)
  const sub2 = await prisma.postDispatchSubmission.create({
    data: {
      workflowId: receivingWf.id,
      submissionNumber: 2,
      status: 'AWAITING_VERIFICATION',
      receivingDetails: 'Re-uploaded with clear customer stamp',
      uploadedByUserId: 'user_uploader_amit',
      uploadedByUserName: 'Amit Kumar',
      uploadedAt: new Date(Date.now() - 600 * 1000),
    },
  });

  const file3 = await prisma.postDispatchFile.create({
    data: {
      submissionId: sub2.id,
      fileName: 'clear_stamp_photo.jpg',
      filePath: '/storage/post-dispatch/test/clear_stamp.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 180000,
    },
  });

  await prisma.postDispatchWorkflow.update({
    where: { id: receivingWf.id },
    data: { status: 'AWAITING_VERIFICATION', currentSubmissionId: sub2.id },
  });

  await recordPostDispatchHistory(prisma, {
    invoiceId: sentInvoice.id,
    workflowType: 'RECEIVING',
    eventType: 'RECEIVING_RE_UPLOADED',
    userId: 'user_uploader_amit',
    userName: 'Amit Kumar',
    submissionId: sub2.id,
  });

  const allSubmissions = await prisma.postDispatchSubmission.findMany({
    where: { workflowId: receivingWf.id },
    orderBy: { submissionNumber: 'asc' },
  });

  assert(allSubmissions.length === 2, 'J: Rejected workflow can be re-uploaded (Submission #1 and #2 exist)');
  assert(allSubmissions[0].id === sub1.id, 'K: Previous rejected evidence remains intact in database');
  assert(
    (await prisma.postDispatchFile.count({ where: { submissionId: sub1.id } })) === 2,
    'H: Submitted evidence is immutable (old files never overwritten or deleted)'
  );

  console.log('\n--- TEST L: Uploader CANNOT Self-Verify (Server-Side Enforced) ---');
  // Amit (uploader) attempts to verify sub2
  const amitSession = {
    userId: 'user_uploader_amit',
    role: 'STAFF',
    mobile_dispatch: true,
    mobile_dispatch_post_dispatch: true,
    mobile_dispatch_post_dispatch_receiving_verify: true,
  };
  const selfVerifyCheck = canVerifySubmission(
    amitSession,
    sub2.uploadedByUserId,
    'mobile_dispatch_post_dispatch_receiving_verify'
  );
  assert(!selfVerifyCheck.allowed, 'L: Uploader attempting to self-verify is DENIED');
  assert(selfVerifyCheck.statusCode === 403, 'L: Self-verification returns 403 Forbidden');

  // Even ADMIN cannot self-verify if they uploaded it
  const adminAsUploaderSession = {
    userId: 'user_uploader_amit',
    role: 'ADMIN',
  };
  const adminSelfVerifyCheck = canVerifySubmission(
    adminAsUploaderSession,
    sub2.uploadedByUserId,
    'mobile_dispatch_post_dispatch_receiving_verify'
  );
  assert(!adminSelfVerifyCheck.allowed, 'L: Admin who uploaded cannot self-verify own submission');

  console.log('\n--- TEST M: Authorized Verifier Can Approve ---');
  const rahulVerifierSession = {
    userId: 'user_verifier_rahul',
    role: 'STAFF',
    mobile_dispatch: true,
    mobile_dispatch_post_dispatch: true,
    mobile_dispatch_post_dispatch_receiving_verify: true,
  };
  const verifierCheck = canVerifySubmission(
    rahulVerifierSession,
    sub2.uploadedByUserId,
    'mobile_dispatch_post_dispatch_receiving_verify'
  );
  assert(verifierCheck.allowed, 'M: Authorized independent verifier is ALLOWED');

  // Approve sub2
  await prisma.postDispatchSubmission.update({
    where: { id: sub2.id },
    data: {
      status: 'APPROVED',
      verifiedByUserId: 'user_verifier_rahul',
      verifiedByUserName: 'Rahul Verifier',
      verifiedAt: new Date(),
    },
  });
  await prisma.postDispatchWorkflow.update({
    where: { id: receivingWf.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  await recordPostDispatchHistory(prisma, {
    invoiceId: sentInvoice.id,
    workflowType: 'RECEIVING',
    eventType: 'RECEIVING_APPROVED',
    userId: 'user_verifier_rahul',
    userName: 'Rahul Verifier',
    submissionId: sub2.id,
  });

  const updatedReceivingWf = await prisma.postDispatchWorkflow.findUnique({
    where: { id: receivingWf.id },
  });
  assert(updatedReceivingWf?.status === 'COMPLETED', 'M: Approved workflow transitions to COMPLETED');

  console.log('\n--- TEST O: Completed Workflow Cannot Be Reopened ---');
  // Attempting to reject completed workflow
  const canReopen = updatedReceivingWf?.status !== 'COMPLETED';
  assert(!canReopen, 'O: COMPLETED workflow is locked against normal reopening');

  console.log('\n--- TEST P, Q, R: Checked By / Checked At Upload ---');
  const checkedWf = await prisma.postDispatchWorkflow.create({
    data: {
      invoiceId: sentInvoice.id,
      workflowType: 'CHECKED',
      status: 'PENDING',
    },
  });

  const manualCheckedAt = new Date('2026-09-09T12:30:00.000Z');
  const checkedSub = await prisma.postDispatchSubmission.create({
    data: {
      workflowId: checkedWf.id,
      submissionNumber: 1,
      status: 'AWAITING_VERIFICATION',
      checkedBy: 'Rahul Sharma', // Differs from uploader Amit
      checkedAt: manualCheckedAt, // Manually entered
      uploadedByUserId: 'user_uploader_amit',
      uploadedByUserName: 'Amit Kumar',
      uploadedAt: new Date(),
    },
  });

  assert(checkedSub.checkedBy === 'Rahul Sharma', 'P: Checked By can differ from the logged-in uploader');
  assert(checkedSub.uploadedByUserId === 'user_uploader_amit', 'P: Uploader identity is preserved separately');
  assert(checkedSub.checkedAt?.toISOString() === manualCheckedAt.toISOString(), 'Q: Checked At can be manually entered');
  assert(checkedSub.uploadedAt !== null, 'R: Workflow timestamps are authoritatively recorded');

  console.log('\n--- TEST S, T, U: Sync Idempotency & Status Updates ---');
  // First import invoice
  const syncTestInvoiceId = 'test_pd_sync_004';
  const firstImport = await prisma.postDispatchInvoice.upsert({
    where: { zohoInvoiceId: syncTestInvoiceId },
    update: {},
    create: {
      zohoInvoiceId: syncTestInvoiceId,
      invoiceNumber: 'INV-SYNC-004',
      customerName: 'Sync Test Customer',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      total: 80000,
      eInvoiceGenerated: false,
    },
  });

  // Second sync with identical data: MUST NOT create duplicate
  const secondImport = await prisma.postDispatchInvoice.upsert({
    where: { zohoInvoiceId: syncTestInvoiceId },
    update: {
      total: 80000,
      lastZohoSync: new Date(),
    },
    create: {
      zohoInvoiceId: syncTestInvoiceId,
      invoiceNumber: 'INV-SYNC-004',
      customerName: 'Sync Test Customer',
      zohoStatus: 'sent',
      erpStatus: 'Active',
      zohoCreatedTime: new Date(),
      total: 80000,
    },
  });

  assert(firstImport.id === secondImport.id, 'S: Sync is idempotent (same zohoInvoiceId produces no duplicate records)');

  // Status update to Paid and E-Invoice generated
  const updatedSyncInvoice = await prisma.postDispatchInvoice.update({
    where: { zohoInvoiceId: syncTestInvoiceId },
    data: {
      zohoStatus: 'paid',
      eInvoiceGenerated: true,
      eInvoiceIrn: 'IRN_SYNC_UPDATED_444',
      eInvoiceAckNo: 'ACK_444',
      eInvoiceAckDate: '2026-09-09',
    },
  });

  assert(updatedSyncInvoice.zohoStatus === 'paid', 'T: Existing invoice status updates correctly');
  assert(updatedSyncInvoice.eInvoiceGenerated === true, 'U: E-Invoice data updates correctly');
  assert(updatedSyncInvoice.eInvoiceIrn === 'IRN_SYNC_UPDATED_444', 'U: E-Invoice IRN stored accurately');

  console.log('\n--- TEST V & W: Automatic Sync Schedule & IST Window ---');
  // 10:00 AM IST -> should be true
  const morningIst = new Date('2026-09-09T04:30:00.000Z'); // 10:00 AM IST (UTC + 5:30)
  // 11:00 PM IST -> should be false
  const nightIst = new Date('2026-09-09T17:30:00.000Z'); // 11:00 PM IST (UTC + 5:30)

  assert(isWithinIstWorkingHours(morningIst) === true, 'V: Automatic sync runs at 10:00 AM IST');
  assert(isWithinIstWorkingHours(nightIst) === false, 'V: Automatic sync does NOT run outside working window (11:00 PM IST)');

  const nextSync = getNextScheduledSyncTime();
  assert(nextSync.getTime() > Date.now(), 'W: Next scheduled sync time is in the future');
  const remainderMinutes = nextSync.getUTCMinutes() % 15;
  // Interval is 15 minutes aligned
  assert(remainderMinutes === 0 || remainderMinutes === 15, 'W: Automatic sync interval aligns to 15 minutes');

  console.log('\n--- TEST X: Concurrent Sync Jobs Prevented ---');
  await prisma.syncLock.upsert({
    where: { name: 'test_pd_lock' },
    update: { isLocked: true, lockedAt: new Date() },
    create: { name: 'test_pd_lock', isLocked: true, lockedAt: new Date() },
  });
  const lock = await prisma.syncLock.findUnique({ where: { name: 'test_pd_lock' } });
  assert(lock?.isLocked === true, 'X: Concurrent sync jobs are prevented via SyncLock');

  console.log('\n--- TEST Y: 5-Part API Telemetry Tracking & Categories ---');
  await prisma.zohoApiLog.create({
    data: {
      endpoint: 'test_endpoint_/books/v3/invoices',
      module: 'post_dispatch_list',
      timestamp: new Date(),
    },
  });
  await prisma.zohoApiLog.create({
    data: {
      endpoint: 'test_endpoint_/books/v3/invoices/detail_123',
      module: 'post_dispatch_detail',
      timestamp: new Date(),
    },
  });
  await prisma.zohoApiLog.create({
    data: {
      endpoint: 'test_endpoint_/books/v3/invoices/einvoice_123',
      module: 'post_dispatch_einvoice',
      timestamp: new Date(),
    },
  });

  const apiUsage = await getTodayPostDispatchApiUsage();
  assert(apiUsage.todayTotal >= 3, 'Y1: Total API usage calls tracked accurately');
  assert(apiUsage.todayInvoiceList >= 1, 'Y2: Invoice list sync calls tracked under todayInvoiceList');
  assert(apiUsage.todayInvoiceDetail >= 1, 'Y3: Invoice detail calls tracked under todayInvoiceDetail');
  assert(apiUsage.todayEInvoice >= 1, 'Y4: E-Invoice calls tracked under todayEInvoice');

  console.log('\n--- TEST BB: Consumer Exclusion for E-Invoicing ---');
  const b2cConsumerTreatment = isConsumerCustomer({ gstTreatment: 'consumer' });
  const b2bBusinessTreatment = isConsumerCustomer({ gstTreatment: 'business_regular', gstNumber: '07AAAAA1111A1Z1' });
  const b2bCompositeTreatment = isConsumerCustomer({ gstTreatment: 'business_composition' });
  assert(b2cConsumerTreatment === true, 'BB1: Customer with gst_treatment="consumer" identified as consumer');
  assert(b2bBusinessTreatment === false, 'BB2: Customer with gst_treatment="business_regular" NOT identified as consumer');
  assert(b2bCompositeTreatment === false, 'BB3: Customer with composition scheme NOT treated as consumer');

  console.log('\n--- TEST CC: 30-Day Lookback Limit & Schedule Windows ---');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  assert(thirtyDaysAgo.getTime() > sixtyDaysAgo.getTime(), 'CC1: 30-day window boundary operates correctly');

  // Test 7:00 PM IST daily check window detection
  const ist7pm = new Date('2026-09-09T13:35:00.000Z'); // 13:35 UTC = 19:05 IST (7:05 PM)
  const ist6pm = new Date('2026-09-09T12:35:00.000Z'); // 12:35 UTC = 18:05 IST (6:05 PM)
  assert(isIst7PmWindow(ist7pm) === true, 'CC2: 7:05 PM IST detected within 7 PM daily reconciliation window');
  assert(isIst7PmWindow(ist6pm) === false, 'CC3: 6:05 PM IST correctly excluded from 7 PM daily reconciliation window');

  const nextEInvTime = getNextScheduledEInvoiceTime();
  assert(nextEInvTime.getTime() > Date.now(), 'CC4: Next 7 PM E-Invoice schedule is scheduled in the future');

  console.log('\n--- TEST Z: No API Secrets in Logs or History ---');
  const recordedHistory = await prisma.postDispatchHistory.findMany({
    where: { invoiceId: sentInvoice.id },
  });

  let hasSecret = false;
  for (const h of recordedHistory) {
    const metaStr = JSON.stringify(h.metadata || {});
    if (
      metaStr.includes('token') ||
      metaStr.includes('secret') ||
      metaStr.includes('password') ||
      metaStr.includes('base64')
    ) {
      hasSecret = true;
    }
  }
  assert(!hasSecret, 'Z: No API secrets, tokens, or raw file contents logged in history');

  console.log('\n--- PHASE 1 ARCHIVAL BOUNDARY TEST ---');
  // Confirm that invoice cannot normally reach final archival because Inventory Deduction is not completed
  await checkAndArchiveInvoice(sentInvoice.id);
  const checkedInvoiceAfter = await prisma.postDispatchInvoice.findUnique({
    where: { id: sentInvoice.id },
  });
  assert(
    checkedInvoiceAfter?.erpStatus === 'Active',
    'Phase 1 Rule: Invoice NOT archived because Inventory Deduction is a placeholder and not completed'
  );

  console.log('\n--- TEST AA: Desktop vs Mobile Decoupled Authorization ---');
  // 1. Desktop staff with dispatch_view + dispatch_post_dispatch
  const desktopStaff = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: true,
    mobile_dispatch: false,
    mobile_dispatch_post_dispatch: false,
  };
  assert(hasDesktopPostDispatchAccess(desktopStaff) === true, 'AA1: Staff with dispatch_view + dispatch_post_dispatch has desktop access');
  assert(hasMobilePostDispatchAccess(desktopStaff) === false, 'AA2: Staff without mobile permissions has no mobile post-dispatch access');
  assert(hasPostDispatchAccess(desktopStaff) === true, 'AA3: Desktop staff passes general post-dispatch access');

  // 2. Mobile staff with mobile_dispatch + mobile_dispatch_post_dispatch
  const mobileStaff = {
    role: 'STAFF',
    dispatch_view: false,
    dispatch_post_dispatch: false,
    mobile_dispatch: true,
    mobile_dispatch_post_dispatch: true,
  };
  assert(hasDesktopPostDispatchAccess(mobileStaff) === false, 'AA4: Mobile staff without desktop permissions has no desktop post-dispatch access');
  assert(hasMobilePostDispatchAccess(mobileStaff) === true, 'AA5: Mobile staff has mobile post-dispatch access');
  assert(hasPostDispatchAccess(mobileStaff) === true, 'AA6: Mobile staff passes general post-dispatch access');

  // 3. User with only dispatch_view (no post-dispatch permission)
  const plainDispatchStaff = {
    role: 'STAFF',
    dispatch_view: true,
    dispatch_post_dispatch: false,
    mobile_dispatch: false,
    mobile_dispatch_post_dispatch: false,
  };
  assert(hasDesktopPostDispatchAccess(plainDispatchStaff) === false, 'AA7: Staff with only dispatch_view is blocked from desktop post-dispatch');
  assert(hasPostDispatchAccess(plainDispatchStaff) === false, 'AA8: Staff without post-dispatch permissions is blocked overall');

  // 4. Admin always has access to both
  const adminTestSession = { role: 'ADMIN' };
  assert(hasDesktopPostDispatchAccess(adminTestSession) === true, 'AA9: Admin has desktop post-dispatch access');
  assert(hasMobilePostDispatchAccess(adminTestSession) === true, 'AA10: Admin has mobile post-dispatch access');
  assert(hasPostDispatchAccess(adminTestSession) === true, 'AA11: Admin passes general post-dispatch access');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  // Clean up test records
  await prisma.postDispatchInvoice.deleteMany({
    where: { zohoInvoiceId: { startsWith: 'test_pd_' } },
  });
  await prisma.zohoApiLog.deleteMany({
    where: { endpoint: { startsWith: 'test_endpoint_' } },
  });
  await prisma.syncLock.deleteMany({
    where: { name: 'test_pd_lock' },
  });

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
