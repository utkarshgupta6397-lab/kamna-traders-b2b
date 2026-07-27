import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const BRANDS_CONFIG: MasterConfig = {
  entityKey: 'brands',
  title: 'Brands Master',
  singularTitle: 'Brand',
  description: 'Manage product brands, track lifecycle status, approvals, and history.',
  permissionPrefix: 'catalog_brands',
};

export default function BrandsPage() {
  return <MasterListPage config={BRANDS_CONFIG} />;
}
