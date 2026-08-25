import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BottomNav from '../_components/BottomNav';

export default async function MobileAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  return (
    <div className="flex-1 flex flex-col pb-[calc(60px+env(safe-area-inset-bottom))] relative">
      {children}
      <BottomNav />
    </div>
  );
}
