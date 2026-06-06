/**
 * Centralized User Permissions Configuration
 * Simplified to focus only on critical operational requirements.
 */

export type PermissionKey = 'canManageCarts' | 'canAdjustInventory' | 'canRunSkuSync' | 'canManageZoneMappings' | 'canManageUnlimitedSkus' | 'canManageTransfers' | 'canDeleteTransfers' | 'accountsAccess' | 'accounts_customer_statement' | 'accounts_transactions' | 'accounts_summary_view' | 'stock_alerts_manage' | 'accounts_recovery_manage' | 'release_statement_queue' | 'dcr_management' | 'dcr_serial_mapping_override' | 'dcr_hold_release';

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
  },
  {
    key: 'stock_alerts_manage',
    label: 'Stock Alerts',
    description: 'Ability to configure and manage minimum stock thresholds'
  },
  {
    key: 'accounts_recovery_manage',
    label: 'Accounts Recovery',
    description: 'Ability to release invoices and manage reminder queues in accounts recovery'
  },
  {
    key: 'release_statement_queue',
    label: 'Release Statement Queue',
    description: 'Ability to release statements and invoices from recovery queue'
  },
  {
    key: 'dcr_management',
    label: 'DCR Management',
    description: 'Ability to manage DCR invoice processing workflow'
  },
  {
    key: 'dcr_serial_mapping_override',
    label: 'Serial Corrections',
    description: 'Ability to correct SKUs, DCR statuses, and purchase records'
  },
  {
    key: 'dcr_hold_release',
    label: 'Hold Queue',
    description: 'Ability to manage hold queue and release DCRs to the operations team'
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
  'accounts_summary_view',
  'stock_alerts_manage',
  'accounts_recovery_manage',
  'release_statement_queue',
  'dcr_management',
  'dcr_serial_mapping_override',
  'dcr_hold_release'
];
