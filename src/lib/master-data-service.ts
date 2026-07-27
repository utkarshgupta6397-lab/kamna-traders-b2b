import { prisma } from './db';

export type MasterEntityKey = 'brands' | 'manufacturers' | 'categories' | 'tax-rates' | 'units' | 'hsn-codes';

export interface EntityMeta {
  key: MasterEntityKey;
  singularName: string;
  pluralName: string;
  modelName: string;
  modelProperty: string;
  codePrefix: string;
  permissionPrefix: string;
  customFields?: string[];
}

export const ENTITY_REGISTRY: Record<MasterEntityKey, EntityMeta> = {
  brands: {
    key: 'brands',
    singularName: 'Brand',
    pluralName: 'Brands',
    modelName: 'Brand',
    modelProperty: 'brand',
    codePrefix: 'BRD',
    permissionPrefix: 'catalog_brands',
  },
  manufacturers: {
    key: 'manufacturers',
    singularName: 'Manufacturer',
    pluralName: 'Manufacturers',
    modelName: 'Manufacturer',
    modelProperty: 'manufacturer',
    codePrefix: 'MNF',
    permissionPrefix: 'catalog_manufacturers',
  },
  categories: {
    key: 'categories',
    singularName: 'Category',
    pluralName: 'Categories',
    modelName: 'Category',
    modelProperty: 'category',
    codePrefix: 'CAT',
    permissionPrefix: 'catalog_categories',
  },
  'tax-rates': {
    key: 'tax-rates',
    singularName: 'Tax Rate',
    pluralName: 'Tax Rates',
    modelName: 'TaxRate',
    modelProperty: 'taxRate',
    codePrefix: 'TAX',
    permissionPrefix: 'catalog_taxrates',
    customFields: ['percentage', 'taxType'],
  },
  units: {
    key: 'units',
    singularName: 'Unit of Measurement',
    pluralName: 'Units of Measurement',
    modelName: 'UnitOfMeasurement',
    modelProperty: 'unitOfMeasurement',
    codePrefix: 'UOM',
    permissionPrefix: 'catalog_units',
    customFields: ['abbreviation'],
  },
  'hsn-codes': {
    key: 'hsn-codes',
    singularName: 'HSN Code',
    pluralName: 'HSN Codes',
    modelName: 'HsnCode',
    modelProperty: 'hsnCode',
    codePrefix: 'HSN',
    permissionPrefix: 'catalog_hsncodes',
    customFields: ['gstRate', 'chapterCode'],
  },
};

export function getPrismaDelegate(entityKey: MasterEntityKey) {
  const meta = ENTITY_REGISTRY[entityKey];
  if (!meta) return null;

  const delegate = (prisma as any)[meta.modelProperty];
  if (!delegate) {
    return {
      count: async () => 0,
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => null,
      create: async (args: any) => ({ id: '10000', ...args.data }),
      update: async (args: any) => ({ id: args.where?.id || '10000', ...args.data }),
    };
  }
  return delegate;
}

/**
 * Generate next sequence ID for a master data entity (numeric string starting at 10000)
 */
export async function getNextMasterId(entityName: string): Promise<string> {
  const seq = await prisma.masterDataSequence.upsert({
    where: { entityName },
    update: { nextVal: { increment: 1 } },
    create: { entityName, nextVal: 10001 },
  });
  
  // If created, return starting value 10000
  if (seq.nextVal === 10001) {
    return '10000';
  }
  return String(seq.nextVal - 1);
}

/**
 * Log immutable audit event
 */
export async function createMasterAuditLog(params: {
  entityType: string;
  entityId: string;
  action: 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'DECLINED' | 'ARCHIVED' | 'RESTORED';
  fieldName?: string;
  previousValue?: string;
  newValue?: string;
  remarks?: string;
  userId: string;
}) {
  const { entityType, entityId, action, fieldName, previousValue, newValue, remarks, userId } = params;
  
  const historyData: any = {
    entityType,
    entityId,
    action,
    fieldName: fieldName || null,
    previousValue: previousValue !== undefined ? String(previousValue) : null,
    newValue: newValue !== undefined ? String(newValue) : null,
    remarks: remarks || null,
    performedById: userId,
  };

  // Connect explicit relation FK if applicable
  if (entityType === 'Brand') historyData.brandId = entityId;
  else if (entityType === 'Category') historyData.categoryId = entityId;
  else if (entityType === 'Manufacturer') historyData.manufacturerId = entityId;
  else if (entityType === 'TaxRate') historyData.taxRateId = entityId;
  else if (entityType === 'UnitOfMeasurement') historyData.unitOfMeasurementId = entityId;
  else if (entityType === 'HsnCode') historyData.hsnCodeId = entityId;

  return await prisma.masterDataHistory.create({
    data: historyData,
  });
}
