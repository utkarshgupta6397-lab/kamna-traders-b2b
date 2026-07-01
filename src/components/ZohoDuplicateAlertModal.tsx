import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface DuplicateErrorProps {
  customerName: string;
  existingOrderId: string;
  existingOrderNumber: string;
  existingStatus: string;
  onClose: () => void;
}

export function ZohoDuplicateAlertModal({ customerName, existingOrderId, existingOrderNumber, existingStatus, onClose }: DuplicateErrorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-red-50 p-4 border-b border-red-100 flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-full text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-800 leading-tight">
              Zoho Customer Conflict
            </h3>
            <p className="text-sm text-red-600 mt-1">
              This Zoho Customer is already linked to an active Solar Order.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Customer:</span>
              <span className="font-semibold text-gray-900">{customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Existing Order:</span>
              <span className="font-semibold text-blue-600">
                <Link href={`/staff/dashboard/solar-orders/orders/${existingOrderId}`} target="_blank" className="hover:underline">
                  {existingOrderNumber}
                </Link>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Status:</span>
              <span className="font-semibold text-gray-900">{existingStatus}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600">
            Only one active Solar Order may exist for a customer at a time. Please complete, cancel, or unlink the existing order before assigning this customer again.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
          >
            Cancel
          </button>
          <Link
            href={`/staff/dashboard/solar-orders/orders/${existingOrderId}`}
            target="_blank"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Open Existing Order
          </Link>
        </div>
      </div>
    </div>
  );
}
