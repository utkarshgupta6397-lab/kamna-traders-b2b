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
    isActive: 'Is Active',
    active: 'Is Active',
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
  static async resolveDiffs(h: any): Promise<AuditChange[]> {
    const prevParsed = parseValue(h.previousValue);
    const nextParsed = parseValue(h.newValue);

    let prevObj: any = {};
    let nextObj: any = {};
    const changes: AuditChange[] = [];

    if ((prevParsed !== null && typeof prevParsed !== 'object') || (nextParsed !== null && typeof nextParsed !== 'object')) {
      // Legacy simple string changes
      changes.push({
        field: 'Status',
        oldValue: prevParsed ? String(prevParsed) : '—',
        newValue: nextParsed ? String(nextParsed) : '—',
      });
    } else {
      prevObj = prevParsed || {};
      nextObj = nextParsed || {};
      
      const keys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]));

      for (const k of keys) {
        if (IGNORED_FIELDS.has(k) || k.endsWith('Base64') || (k.endsWith('Id') && keys.includes(k.replace(/Id$/, '')))) continue;
        
        const oldVal = prevObj[k] ?? '—';
        const newVal = nextObj[k] ?? '—';

        if (String(oldVal) !== String(newVal)) {
          changes.push({
            field: getFieldTitle(k),
            oldValue: String(oldVal),
            newValue: String(newVal),
          });
        }
      }
    }

    return changes;
  }
}
