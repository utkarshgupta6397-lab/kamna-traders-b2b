import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReadyToIssueClient from './ReadyToIssueClient';

export const dynamic = 'force-dynamic';

export default async function ReadyToIssuePage() {
  const session = await getSession();

  if (!session || (!session.dcr_management && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard/accounts/dcr?error=unauthorized');
  }

  return <ReadyToIssueClient />;
}
