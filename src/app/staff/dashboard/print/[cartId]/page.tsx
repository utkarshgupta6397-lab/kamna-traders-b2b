import { PrismaClient } from '@prisma/client';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

import PrintButton from '@/components/PrintButton';

const prisma = new PrismaClient();

export default async function PrintSlipPage({ params }: { params: { cartId: string } }) {
  const cart = await prisma.cart.findUnique({
    where: { id: params.cartId },
    include: {
      warehouse: true,
      staff: true,
      items: {
        include: {
          sku: {
            include: {
              inventory: true // need to get zone from inventory mapping
            }
          }
        }
      }
    }
  });

  if (!cart) {
    return <div>Cart not found</div>;
  }

  // Process items to get zone from inventory
  const enrichedItems = cart.items.map(item => {
    const inv = item.sku.inventory.find(i => i.warehouseId === cart.warehouseId);
    return {
      skuId: item.skuId,
      name: item.sku.name,
      qty: item.qty,
      zone: inv?.zone || 'Unassigned'
    };
  });

  // Group by zone
  const zoneGroups = enrichedItems.reduce((acc, item) => {
    if (!acc[item.zone]) acc[item.zone] = [];
    acc[item.zone].push(item);
    return acc;
  }, {} as Record<string, typeof enrichedItems>);

  // Generate QR payload for Master Slip
  const qrPayload = {
    cart: cart.id,
    items: enrichedItems.map(i => ({ sku: i.skuId, name: i.name, qty: i.qty }))
  };

  return (
    <div className="max-w-md mx-auto print:max-w-none print:w-[80mm] print:mx-0 print:m-0 space-y-8 print:space-y-0">
      
      {/* Non-print controls */}
      <div className="print:hidden space-y-4 mb-8">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
          <h2 className="font-bold">Print Center</h2>
          <div className="space-x-4">
            <Link href="/staff/dashboard" className="text-[#1A2766] font-medium text-sm">Back</Link>
            <PrintButton />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          The view below is formatted for 80mm thermal printers. Use your browser's print function and ensure margins are set to "None".
        </p>
      </div>

      {/* MASTER SLIP */}
      <div className="bg-white p-4 w-[300px] print:w-[80mm] print:shadow-none shadow-sm font-mono text-sm break-inside-avoid print:page-break-after-always">
        <div className="text-center mb-4 border-b border-dashed border-black pb-4">
          <h1 className="text-xl font-bold uppercase">Kamna Traders</h1>
          <p className="text-xs">Master Dispatch Slip</p>
        </div>
        
        <div className="mb-4 text-xs space-y-1">
          <p><strong>Cart ID:</strong> {cart.id}</p>
          <p><strong>Date:</strong> {new Date(cart.createdAt).toLocaleString()}</p>
          <p><strong>Warehouse:</strong> {cart.warehouse.name}</p>
          <p><strong>Customer:</strong> {cart.customerName}</p>
          <p><strong>Staff:</strong> {cart.staff.name}</p>
        </div>

        <div className="border-t border-b border-dashed border-black py-2 mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left">
                <th className="pb-1 w-1/2">Item</th>
                <th className="pb-1 text-center">Zone</th>
                <th className="pb-1 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {enrichedItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1 pr-1 truncate max-w-[120px]">{item.skuId}<br/><span className="text-[10px] text-gray-500">{item.name}</span></td>
                  <td className="py-1 text-center">{item.zone}</td>
                  <td className="py-1 text-right font-bold text-sm">{item.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-center pt-2">
          <QRCodeSVG value={JSON.stringify(qrPayload)} size={120} level="L" />
          <p className="text-[10px] mt-2 text-center">Scan to verify contents</p>
        </div>
      </div>

      {/* ZONE SLIPS */}
      {Object.entries(zoneGroups).map(([zone, items], idx) => (
        <div key={idx} className="bg-white p-4 w-[300px] print:w-[80mm] print:shadow-none shadow-sm font-mono text-sm break-inside-avoid print:page-break-after-always">
          <div className="text-center mb-4 border-b border-black pb-2">
            <h2 className="text-lg font-bold">ZONE SLIP: {zone}</h2>
            <p className="text-xs font-bold">Cart: {cart.id}</p>
          </div>
          
          <div className="mb-2 text-xs">
            <p><strong>Warehouse:</strong> {cart.warehouse.name}</p>
            <p><strong>Date:</strong> {new Date(cart.createdAt).toLocaleString()}</p>
          </div>

          <div className="border-t border-dashed border-black py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b border-black">
                  <th className="pb-1">SKU</th>
                  <th className="pb-1 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, itemIdx) => (
                  <tr key={itemIdx}>
                    <td className="py-2 pr-2">{item.skuId}<br/><span className="text-[10px] truncate max-w-[140px] inline-block">{item.name}</span></td>
                    <td className="py-2 text-right font-bold text-base">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="text-center mt-6 text-xs italic">
            -- End of Zone Slip --
          </div>
        </div>
      ))}
    </div>
  );
}
