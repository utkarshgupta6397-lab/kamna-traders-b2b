import { Suspense } from 'react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RecoveryQueueWorkspace from '@/components/recovery/RecoveryQueueWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminRecoveryQueuePage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/staff?callbackUrl=%2Fadmin%2Faccounts%2Frecovery');
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
