import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OperationsTabs from './OperationsTabs';

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/staff/dashboard?error=unauthorized_operations');
  }

  const isAdmin = session.role === 'ADMIN';
  const canManageTransfers = isAdmin || !!session.canManageTransfers;

  return (
    <OperationsTabs canManageTransfers={canManageTransfers}>
      {children}
    </OperationsTabs>
  );
}
