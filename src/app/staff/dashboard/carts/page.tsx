import { PrismaClient } from '@prisma/client';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { Printer, ExternalLink } from 'lucide-react';

const prisma = new PrismaClient();

export default async function CartsPage() {
  const session = await getSession();
  const isAdmin = session?.role === 'ADMIN';

  const carts = await prisma.cart.findMany({
    where: isAdmin ? {} : { staffId: session?.userId as string },
    include: {
      warehouse: true,
      staff: true,
      items: { include: { sku: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Cart History</h1>
        <Link href="/staff/dashboard" className="text-sm text-[#1A2766] hover:underline">+ New Cart</Link>
      </div>

      {carts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-12 text-center">
          <p className="text-gray-400">No carts yet.</p>
          <Link href="/staff/dashboard" className="mt-3 inline-block bg-[#1A2766] text-white px-5 py-2 rounded-lg text-sm font-medium">
            Create First Cart
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {carts.map(cart => (
            <div key={cart.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-gray-900 font-mono text-sm">{cart.id}</span>
                    <span className="text-xs text-gray-400">{new Date(cart.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{cart.customerName}</span>
                    <span className="text-gray-400"> · {cart.warehouse.name}</span>
                    {isAdmin && <span className="text-gray-400"> · by {cart.staff.name}</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cart.items.slice(0, 6).map(item => (
                      <span key={item.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                        {item.skuId} ×{item.qty}
                      </span>
                    ))}
                    {cart.items.length > 6 && (
                      <span className="text-[10px] text-gray-400">+{cart.items.length - 6} more</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/staff/dashboard/print/${cart.id}`}
                    className="flex items-center gap-1.5 bg-[#1A2766] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#003347] transition-colors"
                  >
                    <Printer size={12} />
                    Print
                  </Link>
                  <Link
                    href={`/staff/dashboard/print/${cart.id}`}
                    target="_blank"
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
