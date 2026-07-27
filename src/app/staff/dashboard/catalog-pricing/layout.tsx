import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CatalogTabs from './CatalogTabs';

export default async function CatalogPricingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // accountsAccess is mapped to 'Catalog & Pricing' permission in this module
  if (!session || (!session.accountsAccess && session.role !== 'ADMIN')) {
    redirect('/staff/dashboard?error=unauthorized');
  }

  return (
    <CatalogTabs>
      {children}
    </CatalogTabs>
  );
}
