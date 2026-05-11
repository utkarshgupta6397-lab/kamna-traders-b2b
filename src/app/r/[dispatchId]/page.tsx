import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';

export default async function RedirectPage({
  params,
}: {
  params: Promise<{ dispatchId: string }>;
}) {
  const { dispatchId } = await params;

  const cart = await prisma.cart.findUnique({
    where: { id: dispatchId },
    select: {
      id: true,
      dispatchSlipNumber: true,
      customerName: true,
      zohoSyncStatus: true,
      zohoSyncStep: true,
      zohoSyncError: true,
      zohoSalesorderId: true,
      zohoSalesorderNumber: true,
      createdAt: true,
    },
  });

  if (!cart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Dispatch</h1>
          <p className="text-gray-600">The dispatch ID you scanned does not exist in our records.</p>
        </div>
      </div>
    );
  }

  // If Zoho Sync is successful and we have a Sales Order ID, redirect
  const orgId = process.env.ZOHO_BOOKS_ORG_ID;
  if (cart.zohoSyncStatus === 'SUCCESS' && cart.zohoSalesorderId && orgId) {
    const booksUrl = `https://books.zoho.in/app/${orgId}#/salesorders/${cart.zohoSalesorderId}`;
    redirect(booksUrl);
  }

  // Otherwise, show the operational status page
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Dispatch Tracking</p>
              <h1 className="text-3xl font-black">{cart.dispatchSlipNumber || cart.id}</h1>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-gray-300 text-sm">Customer: <span className="text-white font-semibold">{cart.customerName}</span></p>
            <p className="text-gray-300 text-xs italic">Created: {new Date(cart.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
              Zoho Books Synchronization
            </h2>
            
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-tight">Current Status</span>
                <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                  cart.zohoSyncStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 
                  cart.zohoSyncStatus === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                  'bg-blue-100 text-blue-700 animate-pulse'
                }`}>
                  {cart.zohoSyncStatus === 'FAILED' ? <AlertCircle className="w-3 h-3" /> : 
                   cart.zohoSyncStatus === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3" /> : 
                   <Clock className="w-3 h-3" />}
                  {cart.zohoSyncStatus || 'PENDING'}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className={`mt-1 w-2 h-2 rounded-full ${cart.zohoSyncStatus === 'SUCCESS' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Sync Step</p>
                    <p className="text-sm text-gray-500 capitalize">{cart.zohoSyncStep?.replace(/_/g, ' ') || 'Queued for processing'}</p>
                  </div>
                </div>

                {cart.zohoSyncError && (
                  <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-900">Sync Error</p>
                      <p className="text-sm text-red-700 leading-tight">{cart.zohoSyncError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
              Actions
            </div>
            {cart.zohoSalesorderId ? (
              <a 
                href={`https://books.zoho.in/app/${orgId}#/salesorders/${cart.zohoSalesorderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-between transition-all active:scale-95 shadow-lg shadow-blue-200"
              >
                <span>Open in Zoho Books</span>
                <ExternalLink className="w-5 h-5" />
              </a>
            ) : (
              <button 
                disabled
                className="w-full bg-gray-100 text-gray-400 font-bold py-4 px-6 rounded-2xl flex items-center justify-between cursor-not-allowed border border-gray-200"
              >
                <span>Link Pending Sync...</span>
                <Clock className="w-5 h-5" />
              </button>
            )}
            
            <p className="text-center text-[10px] text-gray-400 mt-6 px-4">
              This page updates automatically once synchronization completes. Please scan the QR code again if the link remains pending for more than 5 minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
