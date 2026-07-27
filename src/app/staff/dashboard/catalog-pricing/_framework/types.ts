export type MasterStatus = 'Draft' | 'Approval Pending' | 'Active' | 'Inactive' | 'Archived';

export interface MasterRecord {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  status: MasterStatus;
  remarks?: string | null;
  isActive?: boolean;
  percentage?: number;
  taxType?: string;
  abbreviation?: string | null;
  gstRate?: number | null;
  chapterCode?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  approvedById?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  history?: MasterHistoryEntry[];
}

export interface MasterHistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  fieldName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  remarks?: string | null;
  performedById: string;
  performedAt: string;
  performedBy?: { id: string; name: string } | null;
}

export interface MasterConfig {
  entityKey: 'brands' | 'manufacturers' | 'categories' | 'tax-rates' | 'units' | 'hsn-codes';
  title: string;
  singularTitle: string;
  description: string;
  permissionPrefix: string;
  customFields?: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select';
    options?: { label: string; value: string }[];
    required?: boolean;
    helperText?: string;
    uppercase?: boolean;
    pattern?: string;
  }[];
}

export interface MasterKpiStats {
  total: number;
  draft: number;
  pending: number;
  active: number;
  inactive: number;
  archived: number;
}
