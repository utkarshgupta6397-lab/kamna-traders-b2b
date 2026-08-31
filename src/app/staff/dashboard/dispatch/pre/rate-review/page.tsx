'use client';

import React, { useState } from 'react';
import { Search, Filter, RefreshCw, AlertCircle, Clock, AlertTriangle, FileCheck2 } from 'lucide-react';

export default function RateReviewPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
        <h1 className="text-xl font-bold text-gray-900">Rate Review</h1>
        <p className="text-sm text-gray-500 mt-1">Review and process Sales Orders awaiting rate confirmation.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-gray-100 bg-white">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Review</span>
            <Clock size={16} />
          </div>
          <span className="text-2xl font-black text-blue-900">0</span>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Action Required</span>
            <AlertCircle size={16} />
          </div>
          <span className="text-2xl font-black text-amber-900">0</span>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">SLA Breached</span>
            <AlertTriangle size={16} />
          </div>
          <span className="text-2xl font-black text-red-900">0</span>
        </div>
      </div>

      {/* Controls Area */}
      <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100">
        <div className="relative w-full sm:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search SO No. or Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766]"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full sm:w-auto justify-center">
            <Filter size={16} />
            <span>Status</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full sm:w-auto justify-center">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Area (Empty State) */}
      <div className="flex-1 overflow-auto bg-gray-50/30 flex items-center justify-center p-8">
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-4">
            <FileCheck2 size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No Sales Orders awaiting rate review</h3>
          <p className="text-sm text-gray-500 mt-2">
            Sales Orders pushed to Dispatch will appear here for review.
          </p>
        </div>
      </div>
    </div>
  );
}
