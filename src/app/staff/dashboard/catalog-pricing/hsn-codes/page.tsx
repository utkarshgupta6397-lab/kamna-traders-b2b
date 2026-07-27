import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const HSN_CODES_CONFIG: MasterConfig = {
  entityKey: 'hsn-codes',
  title: 'HSN Codes Master',
  singularTitle: 'HSN Code',
  description: 'Maintain Harmonized System of Nomenclature codes and applicable GST slabs.',
  permissionPrefix: 'catalog_hsncodes',
  customFields: [
    { name: 'gstRate', label: 'Default GST Rate (%)', type: 'number' },
    { name: 'chapterCode', label: 'Chapter Code', type: 'text' },
  ],
};

export default function HsnCodesPage() {
  return <MasterListPage config={HSN_CODES_CONFIG} />;
}
