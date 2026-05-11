import { EscPosRenderer } from './esc-pos-renderer';

export type PrintItem = {
  skuId: string;
  name: string;
  qty: number;
  unit: string;
  zone: string;
};

export type PrintPayload = {
  id: string;
  dispatchSlipNumber: string;
  customerName: string;
  notes: string | null;
  createdAt: string;
  warehouseName: string;
  staffName: string;
  items: PrintItem[];
  zoneGroups: Record<string, PrintItem[]>;
  qrPayload: string;
  zohoSalesorderNumber?: string | null;
};

/**
 * High-level renderer for Kamna Traders dispatch slips.
 * Converts a PrintPayload into a single ESC/POS command stream.
 */
export function renderDispatchSlips(payload: PrintPayload): Uint8Array {
  const renderer = new EscPosRenderer();
  const dateStr = new Date(payload.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // 1. MASTER SLIP
  renderer
    .align('center')
    .size('double-width').bold().text('KAMNA TRADERS').bold(false).size('normal')
    .line()
    .text('Master Dispatch Slip')
    .line()
    .line('--------------------------------')
    .align('left')
    .line(`Dispatch No: ${payload.dispatchSlipNumber || payload.id}`)
    .line(`Date: ${dateStr}`)
    .line(`Warehouse: ${payload.warehouseName}`)
    .line(`Customer: ${payload.customerName}`)
    .line(`Staff: ${payload.staffName}`)
    .line('--------------------------------');

  if (payload.zohoSalesorderNumber) {
    renderer.bold().line(`ZOHO SO: ${payload.zohoSalesorderNumber}`).bold(false);
  }

  if (payload.notes) {
    renderer.line(`Notes: ${payload.notes}`);
  }

  renderer.line();

  // Master Items Grouped by Zone
  Object.entries(payload.zoneGroups).forEach(([zone, items]) => {
    renderer
      .bold().line(`[ ${zone.toUpperCase()} ]`).bold(false);
    
    items.forEach(item => {
      // Manual formatting for 80mm (approx 42-48 chars)
      const sku = item.skuId.padEnd(10);
      const qty = `${item.qty} ${item.unit}`.padStart(10);
      const name = item.name.substring(0, 20).padEnd(22);
      renderer.line(`${sku} ${name} ${qty}`);
    });
    renderer.line();
  });

  renderer
    .align('center')
    .qr(payload.qrPayload)
    .line()
    .text('-- End of Master Slip --')
    .cut();

  // 2. ZONE SLIPS
  Object.entries(payload.zoneGroups).forEach(([zone, items]) => {
    renderer
      .reset()
      .align('center')
      .bold().line(`ZONE SLIP - ${zone.toUpperCase()}`)
      .bold(false)
      .line(`No: ${payload.dispatchSlipNumber || payload.id}`)
      .line(`WH: ${payload.warehouseName}`)
      .line('--------------------------------')
      .align('left')
      .line(`Date: ${dateStr}`)
      .line(`Customer: ${payload.customerName}`)
      .line('--------------------------------')
      .line();

    // Zone specific items
    items.forEach(item => {
      const sku = item.skuId.padEnd(12);
      const qty = `${item.qty} ${item.unit}`.padStart(12);
      renderer.bold().line(`${sku} ${qty}`).bold(false);
      renderer.line(`  ${item.name.substring(0, 30)}`);
    });

    renderer
      .line()
      .align('center')
      .line(`-- End of Zone Slip [${zone}] --`)
      .cut();
  });

  return renderer.build();
}
