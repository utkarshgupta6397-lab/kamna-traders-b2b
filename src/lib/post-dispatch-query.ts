import { Prisma } from '@prisma/client';

export interface PostDispatchFilterParams {
  tab?: string | null;
  search?: string | null;
  statusFilter?: string | null;
  warehouseFilter?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Builds the authoritative Prisma `where` clause for PostDispatchInvoice queries.
 * Shared across:
 * 1. Server-side paginated invoice list query
 * 2. Total count for current active tab & filters
 * 3. Dynamic multi-tab counts (All Pending, Verification, Receiving, Check, Inventory, E-Invoice, Archived)
 * 4. "Archive All" dataset matching query
 */
export function buildPostDispatchWhereClause(params: PostDispatchFilterParams): Prisma.PostDispatchInvoiceWhereInput {
  const where: Prisma.PostDispatchInvoiceWhereInput = {};

  const tab = params.tab || 'all_pending';
  const search = (params.search || '').trim();
  const statusFilter = (params.statusFilter || '').trim();
  const warehouse = (params.warehouseFilter || '').trim();
  const { startDate, endDate } = params;

  // 1. Tab filter
  if (tab === 'archived') {
    where.erpStatus = 'Archived';
  } else if (tab === 'receiving_pending') {
    where.erpStatus = 'Active';
    where.workflows = {
      some: {
        workflowType: 'RECEIVING',
        status: { not: 'COMPLETED' },
      },
    };
  } else if (tab === 'check_pending') {
    where.erpStatus = 'Active';
    where.workflows = {
      some: {
        workflowType: 'CHECKED',
        status: { not: 'COMPLETED' },
      },
    };
  } else if (tab === 'inventory_pending') {
    where.erpStatus = 'Active';
    where.workflows = {
      some: {
        workflowType: 'INVENTORY_DEDUCTION',
        status: { not: 'COMPLETED' },
      },
    };
  } else if (tab === 'einvoice_pending') {
    where.erpStatus = 'Active';
    where.eInvoiceGenerated = false;
    where.zohoStatus = { notIn: ['void', 'draft'] };
  } else if (tab === 'verification' || tab === 'verification_pending') {
    where.erpStatus = 'Active';
    where.workflows = {
      some: {
        status: 'AWAITING_VERIFICATION',
      },
    };
  } else if (tab === 'pending') {
    where.erpStatus = 'Active';
    where.workflows = {
      some: {
        status: { in: ['PENDING', 'REWORK_REQUIRED'] },
      },
    };
  } else if (tab === 'all_pending') {
    where.erpStatus = 'Active';
  } else {
    // 'all' tab: Active by default, or all if searching/filtering
    if (!search && !statusFilter && !startDate && !endDate && (!warehouse || warehouse === 'ALL')) {
      where.erpStatus = 'Active';
    }
  }

  // 2. Zoho Status filter
  if (statusFilter && statusFilter.toLowerCase() !== 'all') {
    where.zohoStatus = { equals: statusFilter, mode: 'insensitive' };
  }

  // 3. Date range filter on zohoCreatedTime
  if (startDate || endDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    where.zohoCreatedTime = dateFilter;
  }

  // 4. Warehouse filter on zohoDetailsJson->location_name
  if (warehouse && warehouse !== 'ALL') {
    where.zohoDetailsJson = {
      path: ['location_name'],
      equals: warehouse,
    };
  }

  // 5. Search filter (Invoice #, Customer Name, Sales Order #)
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { customerName: { contains: search, mode: 'insensitive' } },
      { salesOrderNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}
