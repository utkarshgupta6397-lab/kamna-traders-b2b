import React from 'react';
import { Box } from 'lucide-react';
import Link from 'next/link';

interface CurrentStockSidebarProps {
  activeView: 'solar' | 'multi' | 'advanced';
}

export default function CurrentStockSidebar({ activeView }: CurrentStockSidebarProps) {
  const isSolar = activeView === 'solar';
  const isMulti = activeView === 'multi';
  const isAdvanced = activeView === 'advanced';

  return (
    <div className="w-56 flex-shrink-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[fit-content]">
        <nav className="flex flex-col p-3 space-y-4">
          <div>
            <h3 className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              VIEWS
            </h3>
            <div className="space-y-0.5">
              {/* Solar Panel Stock View */}
              <Link 
                href="/staff/dashboard/operations/current-stock" 
                className={`flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium rounded-lg transition-colors border border-transparent text-left ${isSolar ? 'bg-[#1A2766]/5 text-[#1A2766] relative overflow-hidden' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 group'}`}
              >
                {isSolar && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#1A2766]" />}
                <div className={`flex items-center gap-2.5 ${isSolar ? 'pl-1' : ''}`}>
                  <Box size={16} className={isSolar ? '' : 'text-gray-400 group-hover:text-gray-600'} />
                  <span>Solar Panel Stock</span>
                </div>
              </Link>
              
              {/* Multi-Warehouse View */}
              <Link 
                href="/staff/dashboard/operations/current-stock?view=multi" 
                className={`flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium rounded-lg transition-colors border border-transparent text-left ${isMulti ? 'bg-[#1A2766]/5 text-[#1A2766] relative overflow-hidden' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 group'}`}
              >
                {isMulti && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#1A2766]" />}
                <div className={`flex items-center gap-2.5 ${isMulti ? 'pl-1' : ''}`}>
                  <Box size={16} className={isMulti ? '' : 'text-gray-400 group-hover:text-gray-600'} />
                  <span>Multi-Warehouse View</span>
                </div>
              </Link>
              
              {/* Advanced View */}
              <Link 
                href="/staff/dashboard/operations/current-stock?view=advanced" 
                className={`flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium rounded-lg transition-colors border border-transparent text-left ${isAdvanced ? 'bg-[#1A2766]/5 text-[#1A2766] relative overflow-hidden' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 group'}`}
              >
                {isAdvanced && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#1A2766]" />}
                <div className={`flex items-center gap-2.5 ${isAdvanced ? 'pl-1' : ''}`}>
                  <Box size={16} className={isAdvanced ? '' : 'text-gray-400 group-hover:text-gray-600'} />
                  <span>Advanced View</span>
                </div>
              </Link>
              
              {/* Upcoming Views */}
              <button className="flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium rounded-lg transition-colors text-gray-400 hover:bg-gray-50 cursor-not-allowed border border-transparent text-left">
                <div className="flex items-center gap-2.5">
                  <span>Single Warehouse</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-wider border border-gray-200">Soon</span>
              </button>

              <button className="flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium rounded-lg transition-colors text-gray-400 hover:bg-gray-50 cursor-not-allowed border border-transparent text-left">
                <div className="flex items-center gap-2.5">
                  <span>By Category</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-wider border border-gray-200">Soon</span>
              </button>

              <button className="flex items-center justify-between w-full px-2.5 py-2 text-sm font-medium rounded-lg transition-colors text-gray-400 hover:bg-gray-50 cursor-not-allowed border border-transparent text-left">
                <div className="flex items-center gap-2.5">
                  <span>Stock Valuation</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded uppercase tracking-wider border border-gray-200">Soon</span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
