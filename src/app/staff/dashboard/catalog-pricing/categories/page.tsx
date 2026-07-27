import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const CATEGORIES_CONFIG: MasterConfig = {
  entityKey: 'categories',
  title: 'Categories Master',
  singularTitle: 'Category',
  description: 'Organize the product catalog into a hierarchical structure with approval controls.',
  permissionPrefix: 'catalog_categories',
};

export default function CategoriesPage() {
  return <MasterListPage config={CATEGORIES_CONFIG} />;
}
