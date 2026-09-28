import { prisma } from '../src/lib/db';

async function main() {
  const isDryRun = !process.argv.includes('--execute');

  console.log(`=======================================================`);
  console.log(`PreDispatchWorkflow Rate Review Integrity Audit`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (No changes will be written)' : 'LIVE EXECUTION'}`);
  console.log(`=======================================================\n`);

  // Query records where workflow is at step 2 or higher but rateReviewStatus is not COMPLETED
  const records = await prisma.preDispatchWorkflow.findMany({
    where: {
      currentStep: { gte: 2 },
      rateReviewStatus: { not: 'COMPLETED' }
    },
    include: {
      dispatchOrder: {
        select: {
          id: true,
          salesorderNumber: true,
          customerName: true,
          status: true
        }
      }
    }
  });

  console.log(`Found ${records.length} workflow record(s) matching criteria: currentStep >= 2 AND rateReviewStatus != 'COMPLETED'.\n`);

  if (records.length === 0) {
    console.log(`No inconsistent records found.`);
    return;
  }

  for (const wf of records) {
    console.log(`-------------------------------------------------------`);
    console.log(`Workflow ID:           ${wf.id}`);
    console.log(`Dispatch Order ID:     ${wf.dispatchOrderId}`);
    console.log(`Sales Order Number:    ${wf.dispatchOrder?.salesorderNumber}`);
    console.log(`Customer:              ${wf.dispatchOrder?.customerName}`);
    console.log(`Order Status:          ${wf.dispatchOrder?.status}`);
    console.log(`Current Step:          ${wf.currentStep}`);
    console.log(`Rate Review Status:    ${wf.rateReviewStatus}`);
    console.log(`Rate Review Comp At:   ${wf.rateReviewCompletedAt}`);
    console.log(`Rate Review Comp By:   ${wf.rateReviewCompletedBy}`);
    console.log(`Audit Items Verified:  ${Object.keys((wf.rateReviewAudit as any)?.items || {}).length}`);

    // Query workflow history for this order
    const history = await prisma.dispatchWorkflowHistory.findMany({
      where: { dispatchOrderId: wf.dispatchOrderId },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`\nWorkflow History Events (${history.length}):`);
    for (const h of history) {
      console.log(`  [${h.createdAt.toISOString()}] ${h.action} (${h.fromStage} -> ${h.toStage}) by ${h.userName}`);
    }

    const completedEvent = history.find(h => h.action === 'Completed Rate Review');
    const isGenuinelyInconsistent = Boolean(completedEvent || wf.rateReviewCompletedAt);

    console.log(`\nIntegrity Assessment:`);
    console.log(`  Has Completion Timestamp: ${Boolean(wf.rateReviewCompletedAt)}`);
    console.log(`  Has Completion History:   ${Boolean(completedEvent)}`);
    console.log(`  Genuinely Inconsistent:   ${isGenuinelyInconsistent ? 'YES (stale auto-save regressed rateReviewStatus)' : 'NO'}`);

    if (isGenuinelyInconsistent) {
      if (isDryRun) {
        console.log(`  Action in DRY RUN:        WOULD UPDATE rateReviewStatus to 'COMPLETED'`);
      } else {
        await prisma.preDispatchWorkflow.update({
          where: { id: wf.id },
          data: {
            rateReviewStatus: 'COMPLETED'
          }
        });
        console.log(`  Action in EXECUTION:      UPDATED rateReviewStatus to 'COMPLETED'`);
      }
    }
  }

  console.log(`\n=======================================================`);
  console.log(isDryRun ? `Audit finished in dry-run mode. Pass --execute to apply changes.` : `Audit and repair finished.`);
  console.log(`=======================================================`);
}

main()
  .catch((err) => {
    console.error('Audit/Repair failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
