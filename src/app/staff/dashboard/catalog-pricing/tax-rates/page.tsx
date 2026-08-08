import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const TAX_RATES_CONFIG: MasterConfig = {
  entityKey: 'tax-rates',
  title: 'Tax Rates Master',
  singularTitle: 'Tax Rate',
  description: 'Manage tax groups and GST percentages used across catalog items.',
  permissionPrefix: 'catalog_taxrates',
  customFields: [
    { name: 'percentage', label: 'Tax Percentage (%)', type: 'number', required: true },
    {
      name: 'taxType',
      label: 'Tax Type',
      type: 'select',
      options: [
        { label: 'GST', value: 'GST' },
        { label: 'IGST', value: 'IGST' },
        { label: 'CGST+SGST', value: 'CGST+SGST' },
        { label: 'EXEMPT', value: 'EXEMPT' },
      ],
      required: true,
    },
    { 
      name: 'zohoBooksIntraTaxId', 
      label: 'Zoho Books Intra-State Tax ID', 
      type: 'text', 
      required: true, 
      pattern: '^[0-9]+$' 
    },
    { 
      name: 'zohoBooksInterTaxId', 
      label: 'Zoho Books Inter-State Tax ID', 
      type: 'text', 
      required: true, 
      pattern: '^[0-9]+$' 
    },
  ],
};

export default function TaxRatesPage() {
  return <MasterListPage config={TAX_RATES_CONFIG} />;
}
