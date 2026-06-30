import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import ApprovalImageGallery from './ApprovalImageGallery';
import ApprovalActions from './ApprovalActions';
import { User, ShieldAlert, Phone, Zap, IndianRupee, MapPin, Building2, ClipboardList, CheckCircle2 } from 'lucide-react';

export default async function ApprovalReviewScreen({ orderId, canApprove }: { orderId: string, canApprove: boolean }) {
  const order = await prisma.solarOrder.findUnique({
    where: { id: orderId },
    include: {
      createdBy: { select: { name: true } },
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
      subVendor: { select: { name: true } },
      panels: { orderBy: { orderIndex: 'asc' } },
      inverters: { orderBy: { orderIndex: 'asc' } },
      siteImages: { orderBy: { orderIndex: 'asc' } },
    }
  });

  if (!order) {
    notFound();
  }

  const SectionTitle = ({ icon: Icon, title, className = "text-gray-900" }: { icon: any, title: string, className?: string }) => (
    <h2 className={`text-sm font-bold flex items-center gap-2 mb-4 uppercase tracking-wider ${className}`}>
      <Icon size={16} className="opacity-70" />
      {title}
    </h2>
  );

  const Property = ({ label, value, subtext }: { label: string, value: React.ReactNode, subtext?: string }) => (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900">
        {value || <span className="text-gray-400 font-normal">Not specified</span>}
      </p>
      {subtext && <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Header */}
      <div className="bg-amber-50/50 border-b border-amber-100 p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{order.customerName}</h1>
            <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-bold uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {order.status.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-1.5 font-medium text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
              <span className="text-gray-400">#</span> {order.orderNumber}
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              Submitted on {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} by <span className="font-semibold text-gray-700">{order.createdBy?.name || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-xs">
              <Phone size={12} /> {order.phoneNumber}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-10">
        
        {/* Customer & System Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Customer Details */}
          <div>
            <SectionTitle icon={User} title="Customer Details" />
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 grid grid-cols-2 gap-y-6 gap-x-8">
              <Property label="Customer Name" value={order.customerName} />
              <Property label="Phone Number" value={order.phoneNumber} subtext={order.whatsappEnabled ? 'WhatsApp Enabled' : undefined} />
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 mb-1">Lead Source & Assignment</p>
                <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Source:</span>
                    <span className="font-semibold">{order.leadSource.replace('_', ' ')}</span>
                  </div>
                  {order.referralName && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Referred By:</span>
                      <span className="font-semibold">{order.referralName}</span>
                    </div>
                  )}
                  {order.subVendorId ? (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Vendor:</span>
                      <span className="font-bold text-purple-700">{order.subVendor?.name}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Salesman:</span>
                      <span className="font-semibold">{order.salesman?.name || 'Unassigned'}</span>
                    </div>
                  )}
                  {order.callingExecutiveId && (
                    <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                      <span className="text-gray-500">Calling Exec:</span>
                      <span className="font-semibold">{order.callingExecutive?.name}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <Property label="Zoho Link" value={order.zohoBooksCustomerName || 'Unlinked'} />
              </div>
            </div>
          </div>

          {/* System Details */}
          <div>
            <SectionTitle icon={Zap} title="System Details" />
            <div className="bg-blue-50/30 rounded-xl p-5 border border-blue-100/50 grid grid-cols-2 gap-y-6 gap-x-8 h-[calc(100%-2rem)]">
              <Property label="System Size" value={`${order.systemSize} kWp`} />
              <Property label="System Type" value={order.systemType.replace('_', '-')} />
              
              <div className="col-span-2 border-t border-blue-100/50 pt-4">
                <div className="flex items-end justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">Commercial Value</span>
                  <span className="text-xs font-medium text-gray-500">Price per kW</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-xl font-black text-emerald-600">₹{order.totalOrderAmount.toLocaleString('en-IN')}</span>
                  <span className="text-sm font-bold text-gray-700">₹{Math.round(order.totalOrderAmount / order.systemSize).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="col-span-2">
                <Property 
                  label="Financing Status" 
                  value={order.loanCustomer ? 'Loan Processing Required' : 'Direct Payment'} 
                />
              </div>
              
              {order.pendingAmount !== null && order.pendingAmount !== undefined && (
                <div className="col-span-2 border-t border-blue-100/50 pt-4">
                   <Property label="Pending Amount" value={`₹${order.pendingAmount.toLocaleString('en-IN')}`} />
                </div>
              )}
            </div>
          </div>
          
        </div>

        {/* Site & Item Details */}
        <div>
          <SectionTitle icon={ClipboardList} title="Site & Item Details" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-700 uppercase">Solar Panels</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {order.panels.length > 0 ? order.panels.map(p => (
                  <div key={p.id} className="px-4 py-3 flex justify-between items-center bg-white">
                    <span className="text-sm font-medium text-gray-900">{p.description}</span>
                    <span className="text-sm font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">× {p.quantity}</span>
                  </div>
                )) : (
                  <div className="px-4 py-3 text-sm text-gray-400 italic">No panels specified</div>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-700 uppercase">Inverters</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {order.inverters.length > 0 ? order.inverters.map(i => (
                  <div key={i.id} className="px-4 py-3 flex justify-between items-center bg-white">
                    <span className="text-sm font-medium text-gray-900">{i.description}</span>
                    <span className="text-sm font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">× {i.quantity}</span>
                  </div>
                )) : (
                  <div className="px-4 py-3 text-sm text-gray-400 italic">No inverters specified</div>
                )}
              </div>
            </div>
          </div>
          
          {order.floorNumber !== null && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Floor Number:</span>
              <span className="text-sm font-bold text-gray-900">{order.floorNumber}</span>
            </div>
          )}
        </div>

        {/* Uploaded Site Images */}
        <div>
          <SectionTitle icon={Building2} title="Uploaded Site Images" />
          {order.siteImages.length > 0 ? (
            <ApprovalImageGallery images={order.siteImages.map(img => img.fileUrl)} />
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex items-center justify-center bg-gray-50">
              <p className="text-sm text-gray-500 font-medium">No site images uploaded.</p>
            </div>
          )}
        </div>

        {/* Remarks */}
        <div>
          <SectionTitle icon={ShieldAlert} title="Additional Remarks" />
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 min-h-[100px]">
            {order.remarks ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{order.remarks}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No additional remarks provided by the creator.</p>
            )}
          </div>
        </div>

      </div>

      {/* Approval Section */}
      <ApprovalActions 
        orderId={order.id} 
        submittedBy={order.createdBy?.name || 'Unknown'} 
        submittedAt={order.createdAt} 
        canApprove={canApprove} 
      />

    </div>
  );
}
