/**
 * Service to flatten and clean up Prisma objects before writing them to the Audit Log.
 * It translates foreign key relations into their display names and excludes noisy/internal fields.
 */

const IGNORED_FIELDS = new Set([
  'id', 'tenantId', 'organizationId', 'companyId',
  'createdById', 'updatedById', 'deletedById', 'approvedById',
  'thumbnailBase64', 'imageBase64', 'createdAt', 'updatedAt', 'approvedAt',
  'version', 'history', 'password', 'salt',
  'images', 'attachments', 'gallery', 'zohoSyncLogs', 'zohoBookItemId'
]);

function getFieldTitle(key: string): string {
  const map: Record<string, string> = {
    brand: 'Brand',
    manufacturer: 'Manufacturer',
    category: 'Category',
    taxRate: 'GST Rate',
    hsnCode: 'HSN Code',
    unit: 'Unit',
    isActive: 'Is Active',
    status: 'Status',
    sellingPrice: 'Selling Price',
    basePrice: 'Base Price',
    purchasePrice: 'Purchase Price',
    trackInventory: 'Inventory Tracking',
    trackSerials: 'Serial Tracking',
    incentiveTag: 'Incentive Tag',
    zohoBookItemId: 'Zoho Books Link',
    variants: 'Variants',
    variantProducts: 'Variant Products'
  };
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

export class AuditPayloadBuilder {
  static build(record: any): Record<string, string> {
    if (!record || typeof record !== 'object') return {};

    const cleanPayload: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {
      if (IGNORED_FIELDS.has(key)) continue;
      if (key.endsWith('Id') || key.endsWith('Base64')) continue;
      
      const fieldTitle = getFieldTitle(key);

      if (value === null || value === undefined) {
        cleanPayload[fieldTitle] = '—';
        continue;
      }

      if (typeof value === 'boolean') {
        cleanPayload[fieldTitle] = value ? 'Enabled' : 'Disabled';
        continue;
      }

      if (typeof value === 'object') {
        // If it's a related model, try to extract a meaningful name
        if (Array.isArray(value)) {
          if (value.length === 0) {
            cleanPayload[fieldTitle] = '—';
            continue;
          }
          if (key === 'variants' || key === 'variantProducts') {
            cleanPayload[fieldTitle] = `${value.length} variant${value.length === 1 ? '' : 's'}`;
            continue;
          }
          cleanPayload[fieldTitle] = `${value.length} item${value.length === 1 ? '' : 's'}`;
          continue;
        }
        
        const valObj = value as any;
        if (valObj.percentage !== undefined && valObj.percentage !== null) {
          cleanPayload[fieldTitle] = `${valObj.percentage}%`;
        } else if (valObj.name) {
          cleanPayload[fieldTitle] = String(valObj.name);
        } else if (valObj.code) {
          cleanPayload[fieldTitle] = String(valObj.code);
        } else if (valObj.abbreviation) {
          cleanPayload[fieldTitle] = String(valObj.abbreviation);
        } else {
          cleanPayload[fieldTitle] = '—';
        }
        continue;
      }

      // Handle prices
      if (key.toLowerCase().includes('price') || key.toLowerCase().includes('cost')) {
        const num = Number(value);
        if (!isNaN(num)) {
          cleanPayload[fieldTitle] = `₹${num.toFixed(2)}`;
          continue;
        }
      }

      cleanPayload[fieldTitle] = String(value);
    }

    return cleanPayload;
  }

  static buildVariantSummary(variant: any): Record<string, string> {
    if (!variant || typeof variant !== 'object') return {};

    const summary: Record<string, string> = {
      [getFieldTitle('sku')]: String(variant.sku || '—'),
      [getFieldTitle('purchasePrice')]: `₹${Number(variant.purchasePrice || 0).toFixed(2)}`,
      [getFieldTitle('sellingPrice')]: `₹${Number(variant.sellingPrice || 0).toFixed(2)}`,
      [getFieldTitle('trackInventory')]: variant.trackInventory ? 'Enabled' : 'Disabled',
      [getFieldTitle('trackSerials')]: variant.trackSerials ? 'Enabled' : 'Disabled',
    };

    return summary;
  }
}
