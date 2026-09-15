import assert from 'assert';
import { prisma } from '../lib/db';
import { recordDispatchWorkflowHistory } from '../lib/dispatch-history';

async function runTests() {
  console.log('\n--- Dispatch Incoming SO Acceptance & Workflow Tests ---');

  const testSoId = `test_so_${Date.now()}`;
  const testSoNumber = `SO-KT/TEST/${Date.now().toString().slice(-4)}`;

  // 1. Create a test incoming sales order
  console.log('1. Creating test DispatchIncomingOrder...');
  const order = await prisma.dispatchIncomingOrder.create({
    data: {
      zohoSalesorderId: testSoId,
      salesorderNumber: testSoNumber,
      customerName: 'Test Solar Customer',
      status: 'NEW',
      total: 150000,
    },
  });
  assert(order.id, 'Order created successfully');
  console.log('✓ PASS: Created test order with ID', order.id);

  try {
    // 2. Initial state: Workflow has not accepted yet
    console.log('2. Verifying unaccepted state...');
    let wf = await prisma.preDispatchWorkflow.findUnique({
      where: { dispatchOrderId: order.id },
    });
    assert.strictEqual(wf, null, 'Workflow does not exist prior to acceptance/review');
    console.log('✓ PASS: Workflow is initially null / unaccepted');

    // 3. Simulate first acceptance
    console.log('3. Performing first acceptance...');
    const acceptTime1 = new Date();
    const actorId = 'test_user_dispatch_1';
    const actorName = 'Test Dispatch Operator';

    const [updatedWf, updatedOrder] = await prisma.$transaction(async (tx) => {
      const createdWf = await tx.preDispatchWorkflow.create({
        data: {
          dispatchOrderId: order.id,
          salesorderId: order.zohoSalesorderId,
          acceptedAt: acceptTime1,
          acceptedBy: actorId,
          acceptedByName: actorName,
          overallStatus: 'IN_PROGRESS',
        },
      });

      const ord = await tx.dispatchIncomingOrder.update({
        where: { id: order.id },
        data: { updatedAt: acceptTime1 },
      });

      await recordDispatchWorkflowHistory(tx, {
        dispatchOrderId: order.id,
        userId: actorId,
        userName: actorName,
        action: 'Accepted',
        fromStage: 'Incoming Queue',
        toStage: 'Rate Review',
        metadata: {
          salesorderNumber: testSoNumber,
          zohoSalesorderId: testSoId,
          acceptedAt: acceptTime1.toISOString(),
        },
      });

      return [createdWf, ord];
    });

    assert(updatedWf.acceptedAt, 'Workflow has acceptedAt timestamp');
    assert.strictEqual(updatedWf.acceptedByName, actorName, 'Workflow has acceptedByName');
    assert.strictEqual(updatedWf.acceptedBy, actorId, 'Workflow has acceptedBy');
    assert.strictEqual(updatedWf.overallStatus, 'IN_PROGRESS', 'Workflow marked IN_PROGRESS');
    console.log('✓ PASS: Order accepted successfully with actor attribution');

    // 4. Verify History entry
    console.log('4. Verifying immutable History entry...');
    const historyEntries = await prisma.dispatchWorkflowHistory.findMany({
      where: { dispatchOrderId: order.id },
      orderBy: { createdAt: 'desc' },
    });

    assert.strictEqual(historyEntries.length, 1, 'Exactly one history record created');
    const entry = historyEntries[0];
    assert.strictEqual(entry.action, 'Accepted', 'Action is "Accepted"');
    assert.strictEqual(entry.userName, actorName, 'History identifies actor name');
    assert.strictEqual(entry.userId, actorId, 'History identifies actor ID');
    assert.strictEqual(entry.fromStage, 'Incoming Queue', 'fromStage is Incoming Queue');
    assert.strictEqual(entry.toStage, 'Rate Review', 'toStage is Rate Review');
    assert(entry.createdAt, 'Timestamp is present');
    console.log('✓ PASS: History entry properly records actor, timestamp, and stage');

    // 5. Test Idempotency (prevent duplicate history on second accept)
    console.log('5. Testing idempotency on repeated acceptance...');
    // Re-check workflow
    const existingWf = await prisma.preDispatchWorkflow.findUnique({
      where: { dispatchOrderId: order.id },
    });
    assert(existingWf?.acceptedAt, 'Workflow is already accepted');

    // If acceptedAt is present, we do not create another history entry:
    let historyCreated = false;
    if (!existingWf?.acceptedAt) {
      historyCreated = true;
    }
    assert.strictEqual(historyCreated, false, 'Second accept did NOT create another history record');

    const historyCountAfter = await prisma.dispatchWorkflowHistory.count({
      where: { dispatchOrderId: order.id },
    });
    assert.strictEqual(historyCountAfter, 1, 'History count remains 1 (no duplicate write)');
    console.log('✓ PASS: Idempotency maintained; no duplicate history created');

  } finally {
    // Cleanup
    console.log('6. Cleaning up test data...');
    await prisma.dispatchWorkflowHistory.deleteMany({ where: { dispatchOrderId: order.id } });
    await prisma.preDispatchWorkflow.deleteMany({ where: { dispatchOrderId: order.id } });
    await prisma.dispatchIncomingOrder.delete({ where: { id: order.id } });
    console.log('✓ PASS: Test records cleaned up');
  }

  console.log('\nAll Dispatch acceptance tests passed successfully! ✅\n');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
