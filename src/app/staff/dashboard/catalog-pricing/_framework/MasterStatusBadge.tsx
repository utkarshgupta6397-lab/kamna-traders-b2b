import React from 'react';
import { MasterStatus } from './types';

export default function MasterStatusBadge({ status }: { status: MasterStatus }) {
  let colorCls = 'bg-gray-100 text-gray-700 border-gray-200';

  switch (status) {
    case 'Draft':
      colorCls = 'bg-gray-100 text-gray-700 border-gray-200';
      break;
    case 'Approval Pending':
      colorCls = 'bg-amber-50 text-amber-700 border-amber-200';
      break;
    case 'Approved':
      colorCls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'Inactive':
      colorCls = 'bg-blue-50 text-blue-700 border-blue-200';
      break;
    case 'Archived':
      colorCls = 'bg-red-50 text-red-700 border-red-200';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorCls}`}>
      {status}
    </span>
  );
}
