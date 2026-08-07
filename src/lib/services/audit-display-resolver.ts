import { LookupService, Option } from './lookup-service';

export interface AuditChange {
  field: string;
  oldValue: string;
  newValue: string;
}

const ENDPOINTS: Record<string, string> = {
  brandId: '/api/staff/catalog/brands',
  manufacturerId: '/api/staff/catalog/manufacturers',
  categoryId: '/api/staff/catalog/categories',
  taxRateId: '/api/staff/catalog/tax-rates',
  hsnCodeId: '/api/staff/catalog/hsn-codes',
  unitId: '/api/staff/catalog/units',
  unitOfMeasurementId: '/api/staff/catalog/units',
};

const IGNORED_FIELDS = new Set([
  'id', 'tenantId', 'organizationId', 'companyId',
  'createdById', 'updatedById', 'deletedById', 'approvedById',
  'thumbnailBase64', 'imageBase64', 'createdAt', 'updatedAt', 'approvedAt',
  'version', 'history', 'password', 'salt'
]);

function formatValue(key: string, val: any): string {
  if (val === undefined || val === null || val === '') return '—';
  
  if (typeof val === 'boolean') {
    return val ? 'Enabled' : 'Disabled';
  }
  
  if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('amount')) {
    const num = Number(val);
    if (!isNaN(num)) {
      return `₹${num.toFixed(2)}`;
    }
  }
  
  if (key.toLowerCase().includes('percentage') || key.toLowerCase().includes('tax')) {
    const num = Number(val);
    if (!isNaN(num)) {
      return `${num}%`;
    }
  }

  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.length ? val.join(', ') : '—';
    if (val.name) return String(val.name);
    if (val.code) return String(val.code);
    if (val.id) return String(val.id);
    return '—';
  }

  return String(val);
}

function getFieldTitle(key: string): string {
  const map: Record<string, string> = {
    brandId: 'Brand',
    manufacturerId: 'Manufacturer',
    categoryId: 'Category',
    taxRateId: 'GST',
    hsnCodeId: 'HSN Code',
    unitId: 'Unit',
    unitOfMeasurementId: 'Unit',
    isActive: 'Status',
    active: 'Status',
    sellingPrice: 'Selling Price',
    basePrice: 'Base Price',
  };
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

function parseValue(val: string | null | undefined): any {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export class AuditDisplayResolver {
  static async resolveValue(key: string, val: any): Promise<string> {
    if (!val || val === 'null') return '—';
    
    if (ENDPOINTS[key] && typeof val === 'string') {
      const option = await LookupService.fetchById(ENDPOINTS[key], val);
      if (option) {
        if (key === 'categoryId' && option.parent) {
          return `${option.parent.name} → ${option.name}`;
        }
        if (option.percentage !== undefined) return `${option.percentage}%`;
        return option.name || option.code || option.abbreviation || val;
      }
    }
    
    return formatValue(key, val);
  }

  static async resolveDiffs(h: any): Promise<AuditChange[]> {
    const prevParsed = parseValue(h.previousValue);
    const nextParsed = parseValue(h.newValue);

    let prevObj: any = {};
    let nextObj: any = {};
    const changes: AuditChange[] = [];

    if ((prevParsed !== null && typeof prevParsed !== 'object') || (nextParsed !== null && typeof nextParsed !== 'object')) {
      // Handle simple string/primitive changes
      changes.push({
        field: 'Status',
        oldValue: await this.resolveValue('status', prevParsed),
        newValue: await this.resolveValue('status', nextParsed),
      });
    } else {
      prevObj = prevParsed || {};
      nextObj = nextParsed || {};
      
      const keys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]));

      for (const k of keys) {
        if (IGNORED_FIELDS.has(k) || k.endsWith('Base64') || k.endsWith('Id') && keys.includes(k.replace(/Id$/, ''))) continue;
        
        const oldValRaw = prevObj[k];
        const newValRaw = nextObj[k];

        if (JSON.stringify(oldValRaw) !== JSON.stringify(newValRaw)) {
          const oldVal = await this.resolveValue(k, oldValRaw);
          const newVal = await this.resolveValue(k, newValRaw);
          
          if (oldVal !== newVal) {
            changes.push({
              field: getFieldTitle(k),
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }
      }
    }

    return changes;
  }
}
