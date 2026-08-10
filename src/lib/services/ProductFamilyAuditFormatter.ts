import { AuditPayloadBuilder } from './audit-payload-builder';

export interface AuditEventFormat {
  title: string;
  changes: string[];
}

export class ProductFamilyAuditFormatter {
  static formatFamilyCreated(family: any, variantCount: number): string {
    const format: AuditEventFormat = {
      title: `Family Created with ${variantCount} Variant${variantCount === 1 ? '' : 's'}`,
      changes: [
        `Family Name: ${family.name}`,
        `Family SKU: ${family.code}`,
        `Status: ${family.status}`
      ]
    };
    return JSON.stringify(format);
  }

  static formatFamilyUpdated(before: any, after: any): string {
    const changes: string[] = [];
    
    // Create flat dictionaries for comparison using AuditPayloadBuilder
    const flatBefore = AuditPayloadBuilder.build(before);
    const flatAfter = AuditPayloadBuilder.build(after);

    const keys = Array.from(new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]));

    for (const key of keys) {
      const oldVal = flatBefore[key] ?? '—';
      const newVal = flatAfter[key] ?? '—';

      if (oldVal !== newVal && !(oldVal === '—' && newVal === '—')) {
        changes.push(`${key}: ${oldVal} → ${newVal}`);
      }
    }

    const format: AuditEventFormat = {
      title: 'Product Family Updated',
      changes
    };
    return JSON.stringify(format);
  }

  static formatVariantAdded(variant: any, family: any): string {
    const format: AuditEventFormat = {
      title: 'Variant Added',
      changes: [
        `SKU: ${variant.sku}`,
        `Purchase Price: ${variant.purchasePrice != null ? `₹${Number(variant.purchasePrice).toFixed(2)}` : '—'}`,
        `Selling Price: ${variant.sellingPrice != null ? `₹${Number(variant.sellingPrice).toFixed(2)}` : '—'}`
      ]
    };
    return JSON.stringify(format);
  }

  static formatVariantImported(orphan: any, family: any): string {
    const format: AuditEventFormat = {
      title: `Variant Imported: ${orphan.name}`,
      changes: [
        `SKU: ${orphan.code}`,
        `Imported into Family: ${family.name} (${family.code})`
      ]
    };
    return JSON.stringify(format);
  }

  static formatVariantStatusChanged(variant: any, from: string, to: string): string {
    const format: AuditEventFormat = {
      title: `Variant Status Changed (${variant.code || variant.sku})`,
      changes: [
        `Status: ${from} → ${to}`
      ]
    };
    return JSON.stringify(format);
  }

  static formatBulkVariantUpdate(skus: string[], changedFields: Record<string, { from: string, to: string }>): string {
    const changes = [
      `Variant Products: ${skus.join(', ')}`
    ];

    for (const [field, diff] of Object.entries(changedFields)) {
      changes.push(`${field}: ${diff.from} → ${diff.to}`);
    }

    const format: AuditEventFormat = {
      title: `Updated ${skus.length} Variant Product${skus.length === 1 ? '' : 's'}`,
      changes
    };
    return JSON.stringify(format);
  }

  static formatImageUpdated(familyCode: string): string {
    const format: AuditEventFormat = {
      title: 'Parent Image Updated',
      changes: [
        `Image replaced for family ${familyCode}`
      ]
    };
    return JSON.stringify(format);
  }

  static formatZohoSync(status: string, count: number): string {
    const format: AuditEventFormat = {
      title: `Zoho Sync Completed`,
      changes: [
        `Synced ${count} variant${count === 1 ? '' : 's'} with status: ${status}`
      ]
    };
    return JSON.stringify(format);
  }

  static formatStatusAction(action: string, from: string, to: string, remarks?: string): string {
    const changes = [`Status: ${from} → ${to}`];
    
    // Just map action text slightly nicer if we want
    let actionLabel = 'Action Performed';
    if (action === 'submit') actionLabel = 'Submitted for Approval';
    if (action === 'approve') actionLabel = 'Approved';
    if (action === 'decline') actionLabel = 'Declined';
    if (action === 'archive') actionLabel = 'Archived';
    if (action === 'reactivate') actionLabel = 'Reactivated';
    if (action === 'deactivate') actionLabel = 'Deactivated';

    if (remarks) {
      changes.push(`Remarks: ${remarks}`);
    }

    const format: AuditEventFormat = {
      title: actionLabel,
      changes
    };
    return JSON.stringify(format);
  }
}
