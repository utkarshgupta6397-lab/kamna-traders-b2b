import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SerialCorrectionsClient from './SerialCorrectionsClient';

export const dynamic = 'force-dynamic';

export default async function SerialCorrectionsPage() {
  const session = await getSession();

  if (!session || (!session.dcr_serial_mapping_override && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard/accounts/dcr?error=unauthorized_corrections');
  }

  return <SerialCorrectionsClient />;
}
