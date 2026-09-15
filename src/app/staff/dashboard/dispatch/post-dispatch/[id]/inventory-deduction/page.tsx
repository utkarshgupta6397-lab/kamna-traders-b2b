import React from 'react';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import {
  hasDesktopPostDispatchReviewAccess,
  canEditStockAllocation,
  canDeductStock,
  canApproveStockDeduction,
} from '@/lib/post-dispatch-auth';
import InventoryDeductionPageClient from './InventoryDeductionPageClient';

export const metadata: Metadata = {
  title: 'Inventory Deduction & Stock Allocation | KAMNA ERP',
};

export default async function PostDispatchInventoryDeductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/staff');
  }

  // Must have access to Post-Dispatch review workspace
  const canReview = hasDesktopPostDispatchReviewAccess(session);
  if (!canReview) {
    redirect('/unauthorized');
  }

  const { id } = await params;

  const canEditStockAllocationPerm = canEditStockAllocation(session);
  const canDeductStockPerm = canDeductStock(session);
  const canApproveStockDeductionPerm = canApproveStockDeduction(session);

  const currentUserId = (session.userId as string) || (session.id as string);

  return (
    <InventoryDeductionPageClient
      invoiceId={id}
      canEditStockAllocation={canEditStockAllocationPerm}
      canDeductStock={canDeductStockPerm}
      canApproveStockDeduction={canApproveStockDeductionPerm}
      currentUserId={currentUserId}
    />
  );
}
