import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { canViewStockApproval, canApproveStockApproval } from '@/lib/post-dispatch-auth';
import StockApprovalClient from './StockApprovalClient';

export default async function StockApprovalPage() {
  const session = await getSession();
  if (!session) {
    redirect('/staff/dashboard?error=unauthorized_operations');
  }

  if (!canViewStockApproval(session)) {
    redirect('/staff/dashboard/operations/current-stock?error=forbidden_stock_approval');
  }

  const canApprove = canApproveStockApproval(session);
  const currentUserId = (session.userId as string) || (session.id as string);
  const currentUserName = (session.name as string) || 'Staff';

  return (
    <StockApprovalClient
      canApprove={canApprove}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
    />
  );
}
