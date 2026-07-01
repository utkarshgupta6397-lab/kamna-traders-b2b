'use client';

import { X } from 'lucide-react';

interface ChatHeaderProps {
  orderNumber: string;
  customerName: string;
  onClose: () => void;
}

export function ChatHeader({ orderNumber, customerName, onClose }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex flex-col">
        <h2 className="text-sm font-semibold text-gray-900">Project Chat</h2>
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{orderNumber}</span> &bull; {customerName}
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
        aria-label="Close Chat"
      >
        <X size={18} />
      </button>
    </div>
  );
}
