import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BottomNav from '../_components/BottomNav';

export default async function MobileAppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/mobile/login');
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F8F9FB] relative w-full">
      <div className="flex-1 overflow-y-auto flex flex-col relative w-full">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
