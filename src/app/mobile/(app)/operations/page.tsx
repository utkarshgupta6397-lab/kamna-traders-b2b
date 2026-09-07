import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Package, Zap, Wrench } from 'lucide-react';
import { hasMobilePermission, hasMobileFeatureAccess } from '@/lib/mobile-auth';

export default async function MobileOperationsPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (!hasMobilePermission(session, 'mobile_stock_management')) {
    redirect('/mobile');
  }

  const canSolarPanel = hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_solar_panel');
  const canWireCable = hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_wire_cables');
  const canInverter = hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_inverter');
  const canSolarAccessories = hasMobileFeatureAccess(session, 'mobile_stock_management', 'mobile_stock_management_solar_accessories');

  const hasAnyCategory = canSolarPanel || canWireCable || canInverter || canSolarAccessories;

  return (
    <div className="flex-1 flex flex-col font-sans">
      <header className="sticky top-0 z-50 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)]">
        <div className="flex items-center px-1 min-h-[56px] py-1">
          <Link href="/mobile" className="flex items-center gap-1 px-3 py-2 active:opacity-60 transition-opacity">
            <ChevronLeft size={24} strokeWidth={2.5} />
            <span className="font-bold text-[15px]">Stock Management</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full">
        <div className="mb-4 text-[11px] font-bold text-slate-400 tracking-wider uppercase px-1">
          Available Modules
        </div>

        {hasAnyCategory ? (
          <div className="flex flex-col gap-3">
            {canSolarPanel && (
              <Link href="/mobile/operations/solar-panel-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100/50">
                    <Package size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-slate-800 text-[15px]">Solar Panel Stock</div>
                    <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </Link>
            )}

            {canWireCable && (
              <Link href="/mobile/operations/wire-cable-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/50">
                    <Package size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-slate-800 text-[15px]">Wire & Cables Stock</div>
                    <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </Link>
            )}

            {canInverter && (
              <Link href="/mobile/operations/inverter-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50">
                    <Zap size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-slate-800 text-[15px]">Inverter Stock</div>
                    <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </Link>
            )}

            {canSolarAccessories && (
              <Link href="/mobile/operations/solar-accessories-stock" className="flex items-center justify-between bg-white p-4 rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50">
                    <Wrench size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-slate-800 text-[15px]">Solar Accessories</div>
                    <div className="text-[12px] text-slate-500 font-medium">View Current Stock</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300" />
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center">
            <p className="text-sm text-slate-600 font-medium">No stock management categories are assigned to your account.</p>
            <p className="text-xs text-slate-400 mt-1">Please contact your administrator to request access.</p>
          </div>
        )}
      </main>
    </div>
  );
}
