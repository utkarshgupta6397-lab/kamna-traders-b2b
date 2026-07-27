import React from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  breadcrumb?: string;
}

export default function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 min-h-[400px]">
        <div className="w-16 h-16 bg-[#1A2766]/10 text-[#1A2766] rounded-full flex items-center justify-center mb-6 shadow-sm">
          <Construction size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-6">
          {description}
        </p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          Coming Soon in Phase 1
        </span>
      </div>
    </div>
  );
}
