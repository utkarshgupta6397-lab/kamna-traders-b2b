import MasterListPage from '../_framework/MasterListPage';
import { MasterConfig } from '../_framework/types';

const CATEGORIES_CONFIG: MasterConfig = {
  entityKey: 'categories',
  title: 'Categories Master',
  singularTitle: 'Category',
  description: 'Organize the product catalog into a hierarchical structure with approval controls.',
  permissionPrefix: 'catalog_categories',
  customFields: [
    {
      name: 'parentId',
      label: 'Parent Category',
      type: 'category-select',
      helperText: 'Select a Root Category to nest under. Sub-categories cannot have children.'
    }
  ],
};

export default function CategoriesPage() {
  return <MasterListPage config={CATEGORIES_CONFIG} />;
}
