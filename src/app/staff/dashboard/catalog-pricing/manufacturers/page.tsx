import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const MANUFACTURERS_CONFIG: MasterConfig = {
  entityKey: 'manufacturers',
  title: 'Manufacturers Master',
  singularTitle: 'Manufacturer',
  description: 'Manage manufacturer master data, origins, and approval statuses.',
  permissionPrefix: 'catalog_manufacturers',
};

export default function ManufacturersPage() {
  return <MasterListPage config={MANUFACTURERS_CONFIG} />;
}
