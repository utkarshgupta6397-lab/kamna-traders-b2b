import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DcrClient from './DcrClient';

export const dynamic = 'force-dynamic';

export default async function AccountsDcrPage() {
  const session = await getSession();

  if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard/accounts?error=unauthorized_dcr');
  }

  return <DcrClient />;
}
