import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const UNITS_CONFIG: MasterConfig = {
  entityKey: 'units',
  title: 'Units of Measurement Master',
  singularTitle: 'Unit of Measurement',
  description: 'Define standard units of measure (UOM) like PCS, Meters, and Boxes for inventory.',
  permissionPrefix: 'catalog_units',
  customFields: [
    { name: 'abbreviation', label: 'Display Abbreviation', type: 'text', required: true, helperText: 'Used on invoices, inventory and reports.', uppercase: true, pattern: '^[A-Z0-9\\-\\/]+$' },
  ],
};

export default function UnitsPage() {
  return <MasterListPage config={UNITS_CONFIG} />;
}
