import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import PrintButton from '@/components/PrintButton';
import QRBlock from '@/components/QRBlock';

const prisma = new PrismaClient();

export default async function PrintSlipPage({
  params,
}: {
  params: Promise<{ cartId: string }>;
}) {
  const { cartId } = await params;

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      warehouse: true,
      staff: true,
      items: {
        include: {
          sku: { include: { inventory: true } },
        },
      },
    },
  });

  if (!cart) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center">
          <p className="text-gray-500 font-medium">Cart <code>{cartId}</code> not found.</p>
          <Link href="/staff/dashboard" className="mt-4 inline-block text-[#1A2766] text-sm hover:underline">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const enrichedItems = cart.items.map(item => {
    const inv = item.sku.inventory.find(i => i.warehouseId === cart.warehouseId);
    return { skuId: item.skuId, name: item.sku.name, qty: item.qty, zone: inv?.zone ?? 'Unassigned' };
  });

  const zoneGroups = enrichedItems.reduce<Record<string, typeof enrichedItems>>((acc, item) => {
    (acc[item.zone] ??= []).push(item);
    return acc;
  }, {});

  const qrPayload = JSON.stringify(
    enrichedItems.map(i => ({ sku: i.skuId, qty: i.qty }))
  );

  const dateStr = new Date(cart.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).replace(/ /g, '-');

  return (
    <div className="p-4 space-y-6 print:space-y-0 print:p-0">
      {/* ── Screen-only controls ───────────────────────────────────────── */}
      <div className="print:hidden bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">Print Center — {cart.id}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Set printer paper to 80mm · margins to None · scale to 100%
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/staff/dashboard" className="text-sm text-[#1A2766] hover:underline">← Back</Link>
          <PrintButton />
        </div>
      </div>

      {/* ── MASTER SLIP ────────────────────────────────────────────────── */}
      <div className="bg-white w-72 print:w-[80mm] mx-auto print:mx-0 shadow-sm print:shadow-none font-mono text-sm print:break-after-page">
        <div className="text-center border-b-2 border-dashed border-gray-400 py-3 mb-3">
          <p className="text-base font-black uppercase tracking-widest">Kamna Traders</p>
          <p className="text-[10px] text-gray-500">Master Dispatch Slip</p>
        </div>

        <div className="px-3 space-y-0.5 text-xs mb-3">
          <p><span className="font-bold">Cart ID:</span> {cart.id}</p>
          <p><span className="font-bold">Date:</span> {dateStr}</p>
          <p><span className="font-bold">Warehouse:</span> {cart.warehouse.name}</p>
          <p><span className="font-bold">Customer:</span> {cart.customerName}</p>
          {cart.notes && <p><span className="font-bold">Notes:</span> {cart.notes}</p>}
          <p><span className="font-bold">Staff:</span> {cart.staff.name}</p>
        </div>

        <div className="border-t-2 border-b-2 border-dashed border-gray-400 py-2 px-3 mb-3">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left pb-1 font-bold">Item</th>
                <th className="text-center pb-1 font-bold">Zone</th>
                <th className="text-right pb-1 font-bold">Qty</th>
              </tr>
            </thead>
            <tbody>
              {enrichedItems.map((item, idx) => (
                <tr key={idx} className="border-b border-dotted border-gray-200">
                  <td className="py-1">
                    <p className="font-mono">{item.skuId}</p>
                    <p className="text-[9px] text-gray-500 leading-tight">{item.name}</p>
                  </td>
                  <td className="text-center">{item.zone}</td>
                  <td className="text-right font-bold">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-3 pb-3">
          <QRBlock value={qrPayload} />
        </div>
      </div>

      {/* ── ZONE SLIPS ─────────────────────────────────────────────────── */}
      {Object.entries(zoneGroups).map(([zone, zItems], idx) => (
        <div key={idx} className="bg-white w-72 print:w-[80mm] mx-auto print:mx-0 shadow-sm print:shadow-none font-mono text-sm print:break-after-page">
          <div className="text-center border-b-2 border-black py-2 mb-2">
            <p className="text-xs font-black uppercase tracking-widest">Zone Slip · {zone}</p>
            <p className="text-[10px]">Cart: {cart.id} · {cart.warehouse.name}</p>
          </div>
          <div className="px-3 text-[10px] mb-2 flex justify-between items-center text-gray-500">
            <span>{dateStr}</span>
            <span className="font-bold text-gray-800 uppercase max-w-[120px] truncate" title={cart.customerName}>{cart.customerName}</span>
          </div>
          <div className="border-t border-dashed border-gray-400 px-3 pb-3">
            <table className="w-full text-xs mt-1">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="text-left pb-1 font-bold">SKU / Product</th>
                  <th className="text-right pb-1 font-bold">Qty</th>
                </tr>
              </thead>
              <tbody>
                {zItems.map((item, i) => (
                  <tr key={i} className="border-b border-dotted border-gray-200">
                    <td className="py-1.5">
                      <p className="font-mono font-bold">{item.skuId}</p>
                      <p className="text-[9px] text-gray-500">{item.name}</p>
                    </td>
                    <td className="text-right font-black text-sm">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[10px] italic pb-2 text-gray-400">— End of Zone Slip —</p>
        </div>
      ))}
    </div>
  );
}
