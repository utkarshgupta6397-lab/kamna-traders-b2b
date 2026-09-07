/**
 * Centralized User Permissions Configuration
 * Simplified to focus only on critical operational requirements.
 */

export type PermissionKey = 'canManageCarts' | 'canAdjustInventory' | 'canRunSkuSync' | 'canManageZoneMappings' | 'canManageUnlimitedSkus' | 'canManageTransfers' | 'canDeleteTransfers' | 'accountsAccess' | 'accounts_customer_statement' | 'accounts_invoice_processor' | 'accounts_transactions' | 'accounts_summary_view' | 'accounts_reports_salesman' | 'stock_alerts_manage' | 'accounts_recovery_manage' | 'release_statement_queue' | 'dcr_management' | 'dcr_serial_mapping_override' | 'dcr_hold_release' | 'solar_orders_view' | 'solar_orders_create' | 'solar_orders_approval' | 'solar_orders_docs_progress' | 'solar_orders_master_edit' | 'workflow_edits' | 'communications_view' | 'communications_templates' | 'whatsapp_integration' | 'holdQueueReviewEnabled' | 'holdQueueReviewLimit' | 'dispatch_view'
  | 'catalog_brands_create' | 'catalog_brands_modify' | 'catalog_brands_approve'
  | 'catalog_manufacturers_create' | 'catalog_manufacturers_modify' | 'catalog_manufacturers_approve'
  | 'catalog_categories_create' | 'catalog_categories_modify' | 'catalog_categories_approve'
  | 'catalog_product_attributes_create' | 'catalog_product_attributes_modify' | 'catalog_product_attributes_archive'
  | 'catalog_taxrates_create' | 'catalog_taxrates_modify' | 'catalog_taxrates_approve'
  | 'catalog_units_create' | 'catalog_units_modify' | 'catalog_units_approve'
  | 'catalog_hsncodes_create' | 'catalog_hsncodes_modify' | 'catalog_hsncodes_approve'
  | 'catalog_products_create' | 'catalog_products_modify' | 'catalog_products_approve' | 'catalog_products_archive'
  | 'system_productMigration'
  | 'dispatch_rate_review' | 'dispatch_payment_verification' | 'dispatch_truck_details'
  | 'dispatch_ready_for_invoice' | 'dispatch_invoice_confirmation' | 'dispatch_workflow_override'
  | 'dispatch_inventory_deduction' | 'dispatch_receiving_upload' | 'dispatch_checked_by'
  | 'mobile_stock_management' | 'mobile_stock_management_solar_panel' | 'mobile_stock_management_wire_cables' | 'mobile_stock_management_inverter' | 'mobile_stock_management_solar_accessories'
  | 'mobile_accounts' | 'mobile_accounts_customer_statement' | 'mobile_accounts_customer_dcr_lookup'
  | 'mobile_dispatch';

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
    key: 'accountsAccess',
    label: 'Catalog & Pricing',
    description: 'Access to the Catalog & Pricing module'
  },
  {
    key: 'accounts_customer_statement',
    label: 'Customer Statement',
    description: 'Ability to view and print customer account statements'
  },
  {
    key: 'accounts_invoice_processor',
    label: 'Invoice Processor',
    description: 'Ability to convert Zoho invoices to Kamna Traders format'
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
    key: 'accounts_reports_salesman',
    label: 'Accounts Reports - Sales by Salesman',
    description: 'Allows the user to access the Sales by Salesman report inside the Accounts module.'
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
    key: 'solar_orders_approval',
    label: 'Order Approval',
    description: 'Ability to approve or reject solar orders'
  },
  {
    key: 'solar_orders_docs_progress',
    label: 'Workflow Progress',
    description: 'Ability to progress orders through documentation and installation workflows'
  },
  {
    key: 'solar_orders_master_edit',
    label: 'EDIT_SOLAR_ORDER',
    description: 'Master permission: Allows the user to edit any information inside a Solar Order after it has been completed (Order details, Documentation, Installation)'
  },
  {
    key: 'workflow_edits',
    label: 'WORKFLOW EDITS',
    description: 'Ability to edit and rollback completed workflow stages in Documentation and Installation flows.'
  },
  {
    key: 'dispatch_view',
    label: 'Dispatch',
    description: 'Controls whether the Dispatch module is visible and accessible to the user.'
  },
  {
    key: 'dispatch_rate_review',
    label: 'Rate Review',
    description: 'Ability to complete Rate Review in Pre-Dispatch'
  },
  {
    key: 'dispatch_payment_verification',
    label: 'Payment Verification',
    description: 'Ability to complete Payment Verification in Pre-Dispatch'
  },
  {
    key: 'dispatch_truck_details',
    label: 'Truck Details',
    description: 'Ability to complete Truck Details in Pre-Dispatch'
  },
  {
    key: 'dispatch_ready_for_invoice',
    label: 'Ready for Invoice',
    description: 'Ability to complete Ready for Invoice in Pre-Dispatch'
  },
  {
    key: 'dispatch_invoice_confirmation',
    label: 'Invoice Confirmation',
    description: 'Ability to complete Invoice Confirmation in Pre-Dispatch'
  },
  {
    key: 'dispatch_workflow_override',
    label: 'Workflow Override / Reopen',
    description: 'Ability to reopen or override completed Dispatch workflow steps'
  },
  {
    key: 'dispatch_inventory_deduction',
    label: 'Inventory Deduction',
    description: 'Ability to perform Post-Dispatch inventory deduction'
  },
  {
    key: 'dispatch_receiving_upload',
    label: 'Receiving Upload',
    description: 'Ability to upload Post-Dispatch receiving documents'
  },
  {
    key: 'dispatch_checked_by',
    label: 'Checked By / At',
    description: 'Ability to perform Post-Dispatch physical check'
  },
  {
    key: 'communications_view',
    label: 'COMMUNICATIONS',
    description: 'Centralized view of all customer communications.',
  },
  {
    key: 'communications_templates',
    label: 'COMMUNICATIONS TEMPLATES',
    description: 'View and sync WhatsApp message templates from Meta.',
  },
  {
    key: 'whatsapp_integration',
    label: 'WHATSAPP INT',
    description: 'Access to the Admin WhatsApp Integration settings'
  },
  // Master Data Permissions
  { key: 'catalog_brands_create', label: 'Create Brands', description: 'Ability to create brand master records' },
  { key: 'catalog_brands_modify', label: 'Modify Brands', description: 'Ability to edit brand master records' },
  { key: 'catalog_brands_approve', label: 'Approve Brands', description: 'Ability to approve or decline brand records' },
  { key: 'catalog_manufacturers_create', label: 'Create Manufacturers', description: 'Ability to create manufacturer master records' },
  { key: 'catalog_manufacturers_modify', label: 'Modify Manufacturers', description: 'Ability to edit manufacturer master records' },
  { key: 'catalog_manufacturers_approve', label: 'Approve Manufacturers', description: 'Ability to approve or decline manufacturer records' },
  { key: 'catalog_categories_create', label: 'Create Categories', description: 'Ability to create category master records' },
  { key: 'catalog_categories_modify', label: 'Modify Categories', description: 'Ability to edit category master records' },
  { key: 'catalog_categories_approve', label: 'Approve Categories', description: 'Ability to approve or decline category records' },
  { key: 'catalog_product_attributes_create', label: 'Create Attributes', description: 'Ability to create product attribute master records' },
  { key: 'catalog_product_attributes_modify', label: 'Modify Attributes', description: 'Ability to edit product attribute master records' },
  { key: 'catalog_product_attributes_archive', label: 'Archive Attributes', description: 'Ability to archive or restore product attribute records' },
  { key: 'catalog_taxrates_create', label: 'Create Tax Rates', description: 'Ability to create tax rate master records' },
  { key: 'catalog_taxrates_modify', label: 'Modify Tax Rates', description: 'Ability to edit tax rate master records' },
  { key: 'catalog_taxrates_approve', label: 'Approve Tax Rates', description: 'Ability to approve or decline tax rate records' },
  { key: 'catalog_units_create', label: 'Create Units', description: 'Ability to create unit of measurement master records' },
  { key: 'catalog_units_modify', label: 'Modify Units', description: 'Ability to edit unit of measurement master records' },
  { key: 'catalog_units_approve', label: 'Approve Units', description: 'Ability to approve or decline unit of measurement records' },
  { key: 'catalog_hsncodes_create', label: 'Create HSN Codes', description: 'Ability to create HSN code master records' },
  { key: 'catalog_hsncodes_modify', label: 'Modify HSN Codes', description: 'Ability to edit HSN code master records' },
  { key: 'catalog_hsncodes_approve', label: 'Approve HSN Codes', description: 'Ability to approve or decline HSN code records' },
  { key: 'catalog_products_create', label: 'Create Products', description: 'Allows creating new Products.' },
  { key: 'catalog_products_modify', label: 'Modify Products', description: 'Allows editing existing Products.' },
  { key: 'catalog_products_approve', label: 'Approve Products', description: 'Allows approving Product records.' },
  { key: 'catalog_products_archive', label: 'Archive Products', description: 'Allows archiving and restoring Products.' },
  { key: 'system_productMigration', label: 'Run Product Migration', description: 'Allows execution of the one-time legacy SKU → Product migration utility.' },
  // Mobile Dedicated Permissions
  { key: 'mobile_stock_management', label: 'Mobile Stock Management', description: 'Controls whether Stock Management is visible and accessible on mobile.' },
  { key: 'mobile_stock_management_solar_panel', label: 'Mobile Solar Panel Stock', description: 'Allows viewing Solar Panel stock on mobile.' },
  { key: 'mobile_stock_management_wire_cables', label: 'Mobile Wire & Cables Stock', description: 'Allows viewing Wire & Cables stock on mobile.' },
  { key: 'mobile_stock_management_inverter', label: 'Mobile Inverter Stock', description: 'Allows viewing Inverter stock on mobile.' },
  { key: 'mobile_stock_management_solar_accessories', label: 'Mobile Solar Accessories Stock', description: 'Allows viewing Solar Accessories stock on mobile.' },
  { key: 'mobile_accounts', label: 'Mobile Accounts', description: 'Controls whether Accounts is visible and accessible on mobile.' },
  { key: 'mobile_accounts_customer_statement', label: 'Mobile Customer Statement', description: 'Allows viewing Customer Statements on mobile.' },
  { key: 'mobile_accounts_customer_dcr_lookup', label: 'Mobile Customer DCR Lookup', description: 'Allows viewing Customer DCR status on mobile.' },
  { key: 'mobile_dispatch', label: 'Mobile Dispatch', description: 'Allows capturing and viewing truck dispatch photos on mobile.' },
];

export interface CatalogModulePermissionGroup {
  moduleKey: string;
  moduleName: string;
  createKey: PermissionKey;
  modifyKey: PermissionKey;
  approveKey?: PermissionKey;
  archiveKey?: PermissionKey;
}

export const CATALOG_MODULES: CatalogModulePermissionGroup[] = [
  {
    moduleKey: 'products',
    moduleName: 'Products',
    createKey: 'catalog_products_create',
    modifyKey: 'catalog_products_modify',
    approveKey: 'catalog_products_approve',
    archiveKey: 'catalog_products_archive',
  },
  {
    moduleKey: 'brands',
    moduleName: 'Brands',
    createKey: 'catalog_brands_create',
    modifyKey: 'catalog_brands_modify',
    approveKey: 'catalog_brands_approve',
  },
  {
    moduleKey: 'manufacturers',
    moduleName: 'Manufacturers',
    createKey: 'catalog_manufacturers_create',
    modifyKey: 'catalog_manufacturers_modify',
    approveKey: 'catalog_manufacturers_approve',
  },
  {
    moduleKey: 'categories',
    moduleName: 'Categories',
    createKey: 'catalog_categories_create',
    modifyKey: 'catalog_categories_modify',
    approveKey: 'catalog_categories_approve',
  },
  {
    moduleKey: 'attributes',
    moduleName: 'Product Attributes',
    createKey: 'catalog_product_attributes_create',
    modifyKey: 'catalog_product_attributes_modify',
    archiveKey: 'catalog_product_attributes_archive',
  },
  {
    moduleKey: 'taxrates',
    moduleName: 'Tax Rates',
    createKey: 'catalog_taxrates_create',
    modifyKey: 'catalog_taxrates_modify',
    approveKey: 'catalog_taxrates_approve',
  },
  {
    moduleKey: 'units',
    moduleName: 'Units of Measurement',
    createKey: 'catalog_units_create',
    modifyKey: 'catalog_units_modify',
    approveKey: 'catalog_units_approve',
  },
  {
    moduleKey: 'hsncodes',
    moduleName: 'HSN Codes',
    createKey: 'catalog_hsncodes_create',
    modifyKey: 'catalog_hsncodes_modify',
    approveKey: 'catalog_hsncodes_approve',
  },
];

const catalogPermissionKeySet = new Set<string>([
  'catalog_brands_create', 'catalog_brands_modify', 'catalog_brands_approve',
  'catalog_manufacturers_create', 'catalog_manufacturers_modify', 'catalog_manufacturers_approve',
  'catalog_categories_create', 'catalog_categories_modify', 'catalog_categories_approve',
  'catalog_product_attributes_create', 'catalog_product_attributes_modify', 'catalog_product_attributes_archive',
  'catalog_taxrates_create', 'catalog_taxrates_modify', 'catalog_taxrates_approve',
  'catalog_units_create', 'catalog_units_modify', 'catalog_units_approve',
  'catalog_hsncodes_create', 'catalog_hsncodes_modify', 'catalog_hsncodes_approve',
  'catalog_products_create', 'catalog_products_modify', 'catalog_products_approve', 'catalog_products_archive',
]);

export interface DispatchPermissionItem {
  key: PermissionKey;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface DispatchPermissionGroup {
  groupKey: string;
  groupName: string;
  permissions: DispatchPermissionItem[];
}

export const DISPATCH_PERMISSION_GROUPS: DispatchPermissionGroup[] = [
  {
    groupKey: 'pre_dispatch',
    groupName: 'Pre-Dispatch',
    permissions: [
      { key: 'dispatch_rate_review', label: 'Rate Review', description: 'Ability to complete Rate Review in Pre-Dispatch' },
      { key: 'dispatch_payment_verification', label: 'Payment Verification', description: 'Ability to complete Payment Verification in Pre-Dispatch' },
      { key: 'dispatch_truck_details', label: 'Truck Details', description: 'Ability to complete Truck Details in Pre-Dispatch' },
      { key: 'dispatch_ready_for_invoice', label: 'Ready for Invoice', description: 'Ability to complete Ready for Invoice in Pre-Dispatch' },
      { key: 'dispatch_invoice_confirmation', label: 'Invoice Confirmation', description: 'Ability to complete Invoice Confirmation in Pre-Dispatch' },
    ]
  },
  {
    groupKey: 'workflow_control',
    groupName: 'Workflow Control',
    permissions: [
      { key: 'dispatch_workflow_override', label: 'Override / Reopen', description: 'Ability to reopen or override completed Dispatch workflow steps' },
    ]
  },
  {
    groupKey: 'post_dispatch',
    groupName: 'Post-Dispatch',
    permissions: [
      { key: 'dispatch_inventory_deduction', label: 'Inv. Deduction', description: 'Coming Soon - Post-Dispatch Inventory Deduction', disabled: true },
      { key: 'dispatch_receiving_upload', label: 'Receiving Upload', description: 'Coming Soon - Post-Dispatch Receiving Upload', disabled: true },
      { key: 'dispatch_checked_by', label: 'Checked By', description: 'Coming Soon - Post-Dispatch Physical Check', disabled: true },
    ]
  }
];

export const DISPATCH_STEP_PERMISSION_MAP: Record<string, PermissionKey> = {
  'rate-review': 'dispatch_rate_review',
  'payment-verification': 'dispatch_payment_verification',
  'truck-details': 'dispatch_truck_details',
  'ready-for-invoice': 'dispatch_ready_for_invoice',
  'invoice-confirmation': 'dispatch_invoice_confirmation',
};

export const dispatchPermissionKeySet = new Set<string>([
  'dispatch_rate_review',
  'dispatch_payment_verification',
  'dispatch_truck_details',
  'dispatch_ready_for_invoice',
  'dispatch_invoice_confirmation',
  'dispatch_workflow_override',
  'dispatch_inventory_deduction',
  'dispatch_receiving_upload',
  'dispatch_checked_by',
]);

export interface MobilePermissionItem {
  key: PermissionKey;
  label: string;
  description?: string;
  isParent?: boolean;
  parentKey?: PermissionKey;
}

export interface MobilePermissionSection {
  sectionKey: string;
  sectionTitle: string;
  parentKey: PermissionKey;
  parentLabel: string;
  parentDescription: string;
  children: MobilePermissionItem[];
  infoNote?: string;
}

export const MOBILE_PERMISSION_SECTIONS: MobilePermissionSection[] = [
  {
    sectionKey: 'stock_management',
    sectionTitle: 'Stock Management',
    parentKey: 'mobile_stock_management',
    parentLabel: 'Stock Management',
    parentDescription: 'Controls whether the Stock Management module is visible and accessible on mobile.',
    children: [
      { key: 'mobile_stock_management_solar_panel', label: 'Solar Panel Stock', description: 'Access to Solar Panel Stock view on mobile', parentKey: 'mobile_stock_management' },
      { key: 'mobile_stock_management_wire_cables', label: 'Wire & Cables Stock', description: 'Access to Wire & Cables Stock view on mobile', parentKey: 'mobile_stock_management' },
      { key: 'mobile_stock_management_inverter', label: 'Inverter Stock', description: 'Access to Inverter Stock view on mobile', parentKey: 'mobile_stock_management' },
      { key: 'mobile_stock_management_solar_accessories', label: 'Solar Accessories', description: 'Access to Solar Accessories view on mobile', parentKey: 'mobile_stock_management' },
    ],
  },
  {
    sectionKey: 'accounts',
    sectionTitle: 'Accounts',
    parentKey: 'mobile_accounts',
    parentLabel: 'Accounts',
    parentDescription: 'Controls whether the Accounts module is visible and accessible on mobile.',
    children: [
      { key: 'mobile_accounts_customer_statement', label: 'Customer Statement', description: 'Access to Customer Statement lookup and ledger view on mobile', parentKey: 'mobile_accounts' },
      { key: 'mobile_accounts_customer_dcr_lookup', label: 'Customer DCR Lookup', description: 'Access to Customer DCR Lookup on mobile', parentKey: 'mobile_accounts' },
    ],
    infoNote: 'Hold Queue uses existing Accounts/Desktop permissions (dcr_hold_release, holdQueueReviewEnabled, holdQueueReviewLimit).',
  },
  {
    sectionKey: 'dispatch',
    sectionTitle: 'Dispatch',
    parentKey: 'mobile_dispatch',
    parentLabel: 'Mobile Dispatch',
    parentDescription: 'Controls access to the Mobile Dispatch truck photo capture and review flow.',
    children: [],
  },
];

export const mobilePermissionKeySet = new Set<string>([
  'mobile_stock_management',
  'mobile_stock_management_solar_panel',
  'mobile_stock_management_wire_cables',
  'mobile_stock_management_inverter',
  'mobile_stock_management_solar_accessories',
  'mobile_accounts',
  'mobile_accounts_customer_statement',
  'mobile_accounts_customer_dcr_lookup',
  'mobile_dispatch',
]);

// General permissions shown in Main Matrix Tab (excludes Catalog, Dispatch, and Mobile granular permissions)
export const GENERAL_PERMISSIONS = PERMISSIONS.filter(
  p => !catalogPermissionKeySet.has(p.key) && !dispatchPermissionKeySet.has(p.key) && !mobilePermissionKeySet.has(p.key)
);

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'canManageCarts',
  'canAdjustInventory',
  'canRunSkuSync',
  'canManageZoneMappings',
  'canManageUnlimitedSkus',
  'canManageTransfers',
  'canDeleteTransfers',
  'accountsAccess',
  'accounts_customer_statement',
  'accounts_invoice_processor',
  'accounts_transactions',
  'accounts_summary_view',
  'accounts_reports_salesman',
  'stock_alerts_manage',
  'accounts_recovery_manage',
  'release_statement_queue',
  'dcr_management',
  'dcr_serial_mapping_override',
  'dcr_hold_release',
  'solar_orders_view',
  'solar_orders_create',
  'solar_orders_approval',
  'solar_orders_docs_progress',
  'solar_orders_master_edit',
  'workflow_edits',
  'dispatch_view',
  'communications_view',
  'communications_templates',
  'whatsapp_integration',
  'holdQueueReviewEnabled',
  'holdQueueReviewLimit',
  'catalog_brands_create',
  'catalog_brands_modify',
  'catalog_brands_approve',
  'catalog_manufacturers_create',
  'catalog_manufacturers_modify',
  'catalog_manufacturers_approve',
  'catalog_categories_create',
  'catalog_categories_modify',
  'catalog_categories_approve',
  'catalog_product_attributes_create',
  'catalog_product_attributes_modify',
  'catalog_product_attributes_archive',
  'catalog_taxrates_create',
  'catalog_taxrates_modify',
  'catalog_taxrates_approve',
  'catalog_units_create',
  'catalog_units_modify',
  'catalog_units_approve',
  'catalog_hsncodes_create',
  'catalog_hsncodes_modify',
  'catalog_hsncodes_approve',
  'catalog_products_create',
  'catalog_products_modify',
  'catalog_products_approve',
  'catalog_products_archive',
  'system_productMigration',
  'dispatch_rate_review',
  'dispatch_payment_verification',
  'dispatch_truck_details',
  'dispatch_ready_for_invoice',
  'dispatch_invoice_confirmation',
  'dispatch_workflow_override',
  'dispatch_inventory_deduction',
  'dispatch_receiving_upload',
  'dispatch_checked_by',
  'mobile_stock_management',
  'mobile_stock_management_solar_panel',
  'mobile_stock_management_wire_cables',
  'mobile_stock_management_inverter',
  'mobile_stock_management_solar_accessories',
  'mobile_accounts',
  'mobile_accounts_customer_statement',
  'mobile_accounts_customer_dcr_lookup',
  'mobile_dispatch',
];
