/**
 * Service to flatten and clean up Prisma objects before writing them to the Audit Log.
 * It translates foreign key relations into their display names and excludes noisy/internal fields.
 */

const IGNORED_FIELDS = new Set([
  'id', 'tenantId', 'organizationId', 'companyId',
  'createdById', 'updatedById', 'deletedById', 'approvedById',
  'thumbnailBase64', 'imageBase64', 'createdAt', 'updatedAt', 'approvedAt',
  'version', 'history', 'password', 'salt',
  'variants', 'variantProducts', 'images', 'attachments', 'gallery'
]);

function getFieldTitle(key: string): string {
  const map: Record<string, string> = {
    brand: 'Brand',
    manufacturer: 'Manufacturer',
    category: 'Category',
    taxRate: 'GST',
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
        if (Array.isArray(value)) continue; // We ignore arrays of relations
        
        if (value.percentage !== undefined) {
          cleanPayload[fieldTitle] = `${value.percentage}%`;
        } else if (value.name) {
          cleanPayload[fieldTitle] = String(value.name);
        } else if (value.code) {
          cleanPayload[fieldTitle] = String(value.code);
        } else if (value.abbreviation) {
          cleanPayload[fieldTitle] = String(value.abbreviation);
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
}
