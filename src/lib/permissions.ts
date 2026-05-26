/**
 * Centralized User Permissions Configuration
 * Simplified to focus only on critical operational requirements.
 */

export type PermissionKey = 'canManageCarts' | 'canAdjustInventory' | 'canRunSkuSync' | 'canManageZoneMappings' | 'canManageUnlimitedSkus' | 'canManageTransfers' | 'canDeleteTransfers' | 'accountsAccess' | 'accounts_customer_statement' | 'accounts_transactions' | 'accounts_summary_view';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description?: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  { 
    key: 'canManageCarts', 
    label: 'Cart Edit/Delete', 
    description: 'Ability to edit items or delete completed carts' 
  },
  {
    key: 'canAdjustInventory',
    label: 'Inventory Adjust',
    description: 'Ability to manually adjust stock levels in warehouses'
  },
  {
    key: 'canRunSkuSync',
    label: 'SKU Sync',
    description: 'Ability to trigger SKU catalog synchronization from Zoho'
  },
  {
    key: 'canManageZoneMappings',
    label: 'Zone Mapping',
    description: 'Ability to map products to warehouse zones'
  },
  {
    key: 'canManageUnlimitedSkus',
    label: 'Unlimited SKUs',
    description: 'Ability to toggle unlimited stock status on SKUs'
  },
  {
    key: 'canManageTransfers',
    label: 'Stock Transfers',
    description: 'Ability to create, edit, and merge stock transfers',
  },
  {
    key: 'canDeleteTransfers',
    label: 'Delete Transfers',
    description: 'Ability to delete stock transfers'
  },
  {
    key: 'accounts_customer_statement',
    label: 'Customer Statement',
    description: 'Ability to view and print customer account statements'
  },
  {
    key: 'accounts_transactions',
    label: 'Bank Transactions',
    description: 'Ability to view live incoming bank feeds and transactions'
  },
  {
    key: 'accounts_summary_view',
    label: 'Accounts Summary View',
    description: 'Ability to view operational invoice summaries and billing dashboard'
  }
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'canManageCarts',
  'canAdjustInventory',
  'canRunSkuSync',
  'canManageZoneMappings',
  'canManageUnlimitedSkus',
  'canManageTransfers',
  'canDeleteTransfers',
  'accounts_customer_statement',
  'accounts_transactions',
  'accounts_summary_view'
];
