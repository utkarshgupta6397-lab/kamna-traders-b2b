import React from 'react';
import { Box } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden animate-pulse">
      {/* Header Skeleton */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-6 w-32 bg-gray-200 rounded" />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 flex-1 min-w-[250px] bg-gray-200 rounded" />
          <div className="h-9 w-40 bg-gray-200 rounded" />
          <div className="h-9 w-40 bg-gray-200 rounded" />
          <div className="h-9 w-24 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="flex-1 overflow-hidden">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 border-b border-r border-gray-200 w-12"><div className="h-4 w-4 bg-gray-200 rounded mx-auto" /></th>
              <th className="px-4 py-3 border-b border-r border-gray-200 min-w-[250px]"><div className="h-4 w-32 bg-gray-200 rounded" /></th>
              <th className="px-4 py-3 border-b border-r border-gray-200 min-w-[100px]"><div className="h-4 w-16 bg-gray-200 rounded mx-auto" /></th>
              <th className="px-4 py-3 border-b border-r border-gray-200 min-w-[100px]"><div className="h-4 w-16 bg-gray-200 rounded mx-auto" /></th>
              <th className="px-4 py-3 border-b border-gray-200 min-w-[100px]"><div className="h-4 w-16 bg-gray-200 rounded mx-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-4 py-4 border-r border-gray-100"><div className="h-4 w-4 bg-gray-100 rounded mx-auto" /></td>
                <td className="px-4 py-4 border-r border-gray-100"><div className="h-4 w-48 bg-gray-100 rounded" /></td>
                <td className="px-4 py-4 border-r border-gray-100"><div className="h-4 w-12 bg-gray-100 rounded mx-auto" /></td>
                <td className="px-4 py-4 border-r border-gray-100"><div className="h-4 w-12 bg-gray-100 rounded mx-auto" /></td>
                <td className="px-4 py-4"><div className="h-4 w-12 bg-gray-100 rounded mx-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
