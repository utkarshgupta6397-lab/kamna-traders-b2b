/**
 * Centralized User Permissions Configuration
 * Simplified to focus only on critical operational requirements.
 */

export type PermissionKey = 'canManageCarts';

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
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = ['canManageCarts'];
