'use client';

import React, { useState } from 'react';
import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';
import HsnImportModal from './HsnImportModal';
import { FileSpreadsheet } from 'lucide-react';

const HSN_CODES_CONFIG: MasterConfig = {
  entityKey: 'hsn-codes',
  title: 'HSN Codes Master',
  singularTitle: 'HSN Code',
  description: 'Maintain Harmonized System of Nomenclature codes and applicable GST slabs.',
  permissionPrefix: 'catalog_hsncodes',
  customFields: [
    { name: 'defaultGstRateId', label: 'Default GST Rate', type: 'tax-rate-select', required: false },
  ],
};

export default function HsnCodesPage() {
  const [isImportOpen, setIsImportOpen] = useState(false);

  const importAction = (
    <button
      onClick={() => setIsImportOpen(true)}
      className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-colors"
    >
      <FileSpreadsheet size={16} />
      Upload HSN Helper Data
    </button>
  );

  return (
    <>
      <MasterListPage 
        config={HSN_CODES_CONFIG} 
        extraActions={importAction}
      />
      <HsnImportModal 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
