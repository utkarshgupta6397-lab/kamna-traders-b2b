import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RecoveryQueueWorkspace from '@/components/recovery/RecoveryQueueWorkspace';

export const dynamic = 'force-dynamic';

export default async function StaffRecoveryQueuePage() {
  const session = await getSession();

  if (!session) {
    redirect('/staff?callbackUrl=%2Fstaff%2Fdashboard%2Faccounts%2Frecovery');
  }

  const canAccess =
    session.role === 'ADMIN' ||
    Boolean(session.accounts_recovery_manage) ||
    Boolean(session.accounts_summary_view);

  if (!canAccess) {
    redirect('/staff/dashboard?error=unauthorized_accounts_recovery');
  }

  return (
    <Suspense
      fallback={
        <div className="w-full py-16 text-center text-slate-500 font-medium">
          Loading Recovery Queue...
        </div>
      }
    >
      <RecoveryQueueWorkspace />
    </Suspense>
  );
}
