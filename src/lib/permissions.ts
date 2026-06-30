/**
 * Centralized User Permissions Configuration
 * Simplified to focus only on critical operational requirements.
 */

export type PermissionKey = 'canManageCarts' | 'canAdjustInventory' | 'canRunSkuSync' | 'canManageZoneMappings' | 'canManageUnlimitedSkus' | 'canManageTransfers' | 'canDeleteTransfers' | 'accountsAccess' | 'accounts_customer_statement' | 'accounts_transactions' | 'accounts_summary_view' | 'stock_alerts_manage' | 'accounts_recovery_manage' | 'release_statement_queue' | 'dcr_management' | 'dcr_serial_mapping_override' | 'dcr_hold_release' | 'solar_orders_view' | 'solar_orders_create' | 'solar_orders_edit' | 'solar_orders_edit_draft' | 'solar_orders_submit' | 'solar_orders_approve' | 'solar_orders_reject' | 'solar_orders_delete' | 'solar_orders_view_rejected' | 'solar_documentation_view' | 'solar_documentation_edit' | 'solar_documentation_approve' | 'solar_installation_view' | 'solar_installation_complete' | 'solar_upload_documents' | 'solar_view_financials' | 'solar_manage_workflow';

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
  },
  {
    key: 'solar_orders_view',
    label: 'Solar Orders View',
    description: 'Access to the Solar Orders module and all list views'
  },
  {
    key: 'solar_orders_create',
    label: 'Solar Orders Create',
    description: 'Ability to create new solar orders'
  },
  {
    key: 'solar_orders_edit',
    label: 'Solar Orders Edit (Legacy)',
    description: 'Ability to edit existing solar order fields'
  },
  {
    key: 'solar_orders_edit_draft',
    label: 'Edit Draft Orders',
    description: 'Ability to edit orders in Draft status'
  },
  {
    key: 'solar_orders_submit',
    label: 'Submit For Approval',
    description: 'Ability to submit a created order for approval'
  },
  {
    key: 'solar_orders_approve',
    label: 'Approve Orders',
    description: 'Ability to approve orders in PENDING_APPROVAL state'
  },
  {
    key: 'solar_orders_reject',
    label: 'Reject Orders',
    description: 'Ability to reject orders in PENDING_APPROVAL state'
  },
  {
    key: 'solar_orders_delete',
    label: 'Solar Orders Cancel/Delete',
    description: 'Ability to cancel or soft-delete orders'
  },
  {
    key: 'solar_orders_view_rejected',
    label: 'View Rejected Orders',
    description: 'Ability to view orders that have been rejected'
  },
  {
    key: 'solar_documentation_view',
    label: 'Documentation View',
    description: 'View documentation workflow and queue'
  },
  {
    key: 'solar_documentation_edit',
    label: 'Documentation Edit',
    description: 'Mark documentation steps as complete'
  },
  {
    key: 'solar_documentation_approve',
    label: 'Documentation Approve',
    description: 'Approve documentation review steps'
  },
  {
    key: 'solar_installation_view',
    label: 'Installation View',
    description: 'View installation workflow and queue'
  },
  {
    key: 'solar_installation_complete',
    label: 'Installation Complete',
    description: 'Mark installation steps as complete'
  },
  {
    key: 'solar_upload_documents',
    label: 'Upload Documents',
    description: 'Upload files and site images to orders'
  },
  {
    key: 'solar_view_financials',
    label: 'View Financials',
    description: 'Access the Financials tab (order amounts, Zoho data, subsidy)'
  },
  {
    key: 'solar_manage_workflow',
    label: 'Manage Workflow',
    description: 'Admin-level workflow configuration and step override'
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
  'dcr_hold_release',
  'solar_orders_view',
  'solar_orders_create',
  'solar_orders_edit',
  'solar_orders_edit_draft',
  'solar_orders_submit',
  'solar_orders_approve',
  'solar_orders_reject',
  'solar_orders_delete',
  'solar_orders_view_rejected',
  'solar_documentation_view',
  'solar_documentation_edit',
  'solar_documentation_approve',
  'solar_installation_view',
  'solar_installation_complete',
  'solar_upload_documents',
  'solar_view_financials',
  'solar_manage_workflow'
];
