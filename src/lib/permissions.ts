/**
 * Centralized User Permissions Configuration
 * Simplified to focus only on critical operational requirements.
 */

export type PermissionKey = 'canManageCarts' | 'canAdjustInventory';

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
  }
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = ['canManageCarts', 'canAdjustInventory'];
