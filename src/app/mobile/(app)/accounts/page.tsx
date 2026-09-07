import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users, ChevronRight, Activity, FileText } from 'lucide-react';
import { hasMobilePermission, hasMobileFeatureAccess } from '@/lib/mobile-auth';

export default async function MobileAccountsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Hold Queue users can access Accounts hub if they have dcr_hold_release or ADMIN,
  // or if user has mobile_accounts permission.
  const hasAccountsHubAccess =
    hasMobilePermission(session, 'mobile_accounts') ||
    session.role === 'ADMIN' ||
    Boolean(session.dcr_hold_release);

  if (!hasAccountsHubAccess) {
    redirect('/mobile');
  }

  const canViewStatement = hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_statement');
  const canViewDcrLookup = hasMobileFeatureAccess(session, 'mobile_accounts', 'mobile_accounts_customer_dcr_lookup');
  // Hold Queue flow retains desktop permission model (dcr_hold_release)
  const canViewHoldQueue = session.role === 'ADMIN' || Boolean(session.dcr_hold_release);

  const hasAnyCard = canViewStatement || canViewDcrLookup || canViewHoldQueue;

  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Accounts</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full">
        {hasAnyCard ? (
          <>
            {(canViewStatement || canViewDcrLookup) && (
              <>
                <div className="mb-4 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
                  Available Modules
                </div>

                {canViewStatement && (
                  <Link href="/mobile/accounts/customer-statement" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform mb-3">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100/50">
                        <FileText size={22} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="font-bold text-slate-800 text-[15px]">Customer Statement</div>
                        <div className="text-[12px] text-slate-500 font-medium">View Customer Ledger & Balances</div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300" />
                  </Link>
                )}

                {canViewDcrLookup && (
                  <Link href="/mobile/accounts/customer-dcr-lookup" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50">
                        <Users size={22} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="font-bold text-slate-800 text-[15px]">Customer DCR Lookup</div>
                        <div className="text-[12px] text-slate-500 font-medium">View Customer Pending DCRs</div>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300" />
                  </Link>
                )}
              </>
            )}

            {canViewHoldQueue && (
              <>
                <div className="mb-4 mt-8 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
                  Manage DCR
                </div>

                <Link href="/mobile/accounts/hold-queue" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100/50">
                      <Activity size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="font-bold text-slate-800 text-[15px]">Hold Queue</div>
                      <div className="text-[12px] text-slate-500 font-medium">Management approval & release</div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300" />
                </Link>
              </>
            )}
          </>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center">
            <p className="text-sm text-slate-600 font-medium">No accounts modules are assigned to your account.</p>
            <p className="text-xs text-slate-400 mt-1">Please contact your administrator to request access.</p>
          </div>
        )}
      </main>
    </div>
  );
}
