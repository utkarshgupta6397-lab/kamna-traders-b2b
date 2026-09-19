import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLineOperationsPending,
  isLineCompleted,
} from '@/lib/stock-deduction-service';

describe('Post-Dispatch Invoice Items Strip - Operational Filter Logic', () => {
  // Scenario 1: DEDUCTED items are NOT Operations pending
  it('1. DEDUCTED lines are NOT Operations pending', () => {
    const line = {
      allocation: { status: 'DEDUCTED' },
      mappingRequired: false,
    };
    assert.equal(isLineOperationsPending(line), false);
    assert.equal(isLineCompleted(line), true);
  });

  // Scenario 2: SUBMITTED_FOR_APPROVAL items are NOT Operations pending
  it('2. SUBMITTED_FOR_APPROVAL lines are NOT Operations pending (ops is waiting on approver)', () => {
    const line = {
      allocation: { status: 'SUBMITTED_FOR_APPROVAL' },
      mappingRequired: false,
    };
    assert.equal(isLineOperationsPending(line), false);
    assert.equal(isLineCompleted(line), false);
  });

  // Scenario 3: APPROVED items are NOT Operations pending
  it('3. APPROVED lines are NOT Operations pending', () => {
    const line = {
      allocation: { status: 'APPROVED' },
      mappingRequired: false,
    };
    assert.equal(isLineOperationsPending(line), false);
    assert.equal(isLineCompleted(line), false);
  });

  // Scenario 4: REWORK_REQUIRED and REJECTED items ARE Operations pending
  it('4. REWORK_REQUIRED and REJECTED lines ARE Operations pending (action returned to ops)', () => {
    const reworkLine = {
      allocation: { status: 'REWORK_REQUIRED' },
      mappingRequired: false,
    };
    const rejectedLine = {
      allocation: { status: 'REJECTED' },
      mappingRequired: false,
    };
    assert.equal(isLineOperationsPending(reworkLine), true);
    assert.equal(isLineOperationsPending(rejectedLine), true);
  });

  // Scenario 5: Unallocated and DRAFT items ARE Operations pending
  it('5. Unallocated (null / NOT_ALLOCATED) and DRAFT lines ARE Operations pending', () => {
    const nullLine = {
      allocation: null,
      mappingRequired: false,
    };
    const notAllocatedLine = {
      allocation: { status: 'NOT_ALLOCATED' },
      mappingRequired: false,
    };
    const draftLine = {
      allocation: { status: 'DRAFT' },
      mappingRequired: false,
    };
    assert.equal(isLineOperationsPending(nullLine), true);
    assert.equal(isLineOperationsPending(notAllocatedLine), true);
    assert.equal(isLineOperationsPending(draftLine), true);
  });

  // Scenario 6: mappingRequired lines ARE Operations pending
  it('6. Lines requiring SKU mapping ARE Operations pending regardless of allocation', () => {
    const unmappedLine = {
      allocation: null,
      mappingRequired: true,
    };
    const unmappedWithAlloc = {
      allocation: { status: 'NOT_ALLOCATED' },
      mappingRequired: true,
    };
    assert.equal(isLineOperationsPending(unmappedLine), true);
    assert.equal(isLineOperationsPending(unmappedWithAlloc), true);
  });

  // Scenario 7: isLineCompleted returns true only for DEDUCTED status
  it('7. isLineCompleted returns true only for DEDUCTED status', () => {
    assert.equal(isLineCompleted({ allocation: { status: 'DEDUCTED' } }), true);
    assert.equal(isLineCompleted({ allocation: { status: 'SUBMITTED_FOR_APPROVAL' } }), false);
    assert.equal(isLineCompleted({ allocation: { status: 'APPROVED' } }), false);
    assert.equal(isLineCompleted({ allocation: { status: 'DRAFT' } }), false);
    assert.equal(isLineCompleted({ allocation: null }), false);
    assert.equal(isLineCompleted(null), false);
  });

  // Scenario 8: Partitioning of invoice lines and accurate counts
  it('8. Correctly computes pending and total counts for mixed invoice lines', () => {
    const lines = [
      { line: { id: 'line-1' }, allocation: { status: 'DEDUCTED' }, mappingRequired: false },
      { line: { id: 'line-2' }, allocation: { status: 'DEDUCTED' }, mappingRequired: false },
      { line: { id: 'line-3' }, allocation: { status: 'SUBMITTED_FOR_APPROVAL' }, mappingRequired: false },
      { line: { id: 'line-4' }, allocation: { status: 'REWORK_REQUIRED' }, mappingRequired: false },
      { line: { id: 'line-5' }, allocation: null, mappingRequired: false },
    ];

    const pendingLines = lines.filter(l => isLineOperationsPending(l));
    const pendingCount = pendingLines.length;
    const allCount = lines.length;

    assert.equal(pendingCount, 2);
    assert.equal(allCount, 5);
    assert.deepEqual(pendingLines.map(l => l.line.id), ['line-4', 'line-5']);
  });

  // Scenario 9: Default view determination logic
  it('9. Default view determination: PENDING if pending > 0, ALL if pending === 0, ALL if deep-linking non-pending', () => {
    function resolveInitialFilter(lines: any[], deepLinkedLineId?: string): 'PENDING' | 'ALL' {
      const pendingCount = lines.filter(l => isLineOperationsPending(l)).length;
      if (deepLinkedLineId) {
        const target = lines.find(l => l.line.id === deepLinkedLineId);
        if (target && !isLineOperationsPending(target)) {
          return 'ALL';
        }
      }
      return pendingCount > 0 ? 'PENDING' : 'ALL';
    }

    const mixedLines = [
      { line: { id: 'l1' }, allocation: { status: 'DEDUCTED' } },
      { line: { id: 'l2' }, allocation: null },
    ];
    assert.equal(resolveInitialFilter(mixedLines), 'PENDING');
    // Deep linking to deducted item l1 should open ALL view
    assert.equal(resolveInitialFilter(mixedLines, 'l1'), 'ALL');
    // Deep linking to pending item l2 should open PENDING view
    assert.equal(resolveInitialFilter(mixedLines, 'l2'), 'PENDING');

    const completedLines = [
      { line: { id: 'l1' }, allocation: { status: 'DEDUCTED' } },
      { line: { id: 'l2' }, allocation: { status: 'SUBMITTED_FOR_APPROVAL' } },
    ];
    assert.equal(resolveInitialFilter(completedLines), 'ALL');
  });

  // Scenario 10: Auto-advance & fallback selection logic
  it('10. Auto-advance selects next pending line or transitions to ALL when all items are done', () => {
    function getNextSelection(
      currentVisible: { id: string }[],
      currentSelectedId: string | null
    ): string | null {
      if (currentVisible.length === 0) return null;
      if (currentSelectedId && currentVisible.some(l => l.id === currentSelectedId)) {
        return currentSelectedId;
      }
      return currentVisible[0].id;
    }

    // Step A: We have 2 pending lines (P1, P2) and P1 is selected
    const initialPending = [{ id: 'P1' }, { id: 'P2' }];
    assert.equal(getNextSelection(initialPending, 'P1'), 'P1');

    // Step B: P1 is deducted! Now pending lines are just [P2]
    // P1 is no longer in pending, so selection auto-advances to P2
    const remainingPending = [{ id: 'P2' }];
    assert.equal(getNextSelection(remainingPending, 'P1'), 'P2');

    // Step C: P2 is deducted! Pending is now empty []
    // Filter switches to ALL, which contains [P1, P2]. P2 is still in ALL!
    const allLines = [{ id: 'P1' }, { id: 'P2' }];
    assert.equal(getNextSelection(allLines, 'P2'), 'P2');
  });
});
