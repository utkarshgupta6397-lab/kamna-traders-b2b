import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { User, Users, Briefcase, Zap, Building2, MapPin, Hash, MessageSquare, Link as LinkIcon, BadgeIndianRupee, Phone } from 'lucide-react';

export default async function OrderDetailOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const order = await prisma.solarOrder.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
      approvedBy: { select: { name: true } },
      subVendor: { select: { name: true } },
      panels: { orderBy: { orderIndex: 'asc' } },
      inverters: { orderBy: { orderIndex: 'asc' } },
      files: { where: { fileCategory: 'SITE_IMAGE', isDeleted: false } },
    }
  });

  if (!order) {
    notFound();
  }

  const SectionTitle = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-5 uppercase tracking-wider">
      <Icon size={16} className="text-gray-400" />
      {title}
    </h2>
  );

  const Property = ({ label, value, subtext, highlight = false }: { label: string, value: React.ReactNode, subtext?: string, highlight?: boolean }) => (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-sm ${highlight ? 'font-medium text-blue-600' : 'font-medium text-gray-900'}`}>
        {value || <span className="text-gray-400 font-normal">Not specified</span>}
      </p>
      {subtext && <p className="text-xs text-gray-500 mt-0.5">{subtext}</p>}
    </div>
  );

  const cardClasses = "bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-500 pt-6">
      
      {/* Left Column (Wider) */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Client & Origin */}
        <div className={cardClasses}>
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <SectionTitle icon={User} title="Client & Origin" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-8">
            <Property 
              label="Customer Name" 
              value={order.customerName} 
            />
            <Property 
              label="Contact Info" 
              value={order.phoneNumber} 
              subtext={order.whatsappEnabled ? '✓ WhatsApp Enabled' : undefined}
            />
            <Property 
              label="Lead Source" 
              value={order.leadSource.replace('_', ' ')} 
            />
            {order.referralName && (
              <Property 
                label="Referred By" 
                value={order.referralName} 
              />
            )}
            <Property 
              label="Zoho Link" 
              value={order.zohoBooksCustomerName || 'Unlinked'} 
              highlight={!!order.zohoBooksCustomerName}
            />
          </div>
        </div>

        {/* System Specs */}
        <div className={cardClasses}>
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
          <SectionTitle icon={Zap} title="System Specifications" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-8">
            <Property 
              label="Capacity" 
              value={`${order.systemSize} kW`} 
            />
            <Property 
              label="Architecture" 
              value={order.systemType.replace('_', '-')} 
            />
            <Property 
              label="Financing" 
              value={order.loanCustomer ? 'Loan Processing Required' : 'Direct Payment'} 
              subtext={order.loanCustomer ? 'Action needed' : undefined}
            />
            <Property 
              label="Total Value" 
              value={`₹${order.totalOrderAmount.toLocaleString('en-IN')}`} 
            />
          </div>
        </div>

        {/* Site & Item Details */}
        <div className={cardClasses}>
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          <SectionTitle icon={Zap} title="Site & Item Details" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Solar Panels</p>
              <ul className="text-sm font-medium text-gray-900 space-y-1">
                {order.panels.length > 0 ? order.panels.map(p => (
                  <li key={p.id}>• {p.description} <span className="text-gray-500">× {p.quantity}</span></li>
                )) : <li className="text-gray-400">None</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Inverters</p>
              <ul className="text-sm font-medium text-gray-900 space-y-1">
                {order.inverters.length > 0 ? order.inverters.map(i => (
                  <li key={i.id}>• {i.description} <span className="text-gray-500">× {i.quantity}</span></li>
                )) : <li className="text-gray-400">None</li>}
              </ul>
            </div>
            <Property 
              label="Floor Number" 
              value={order.floorNumber !== null ? order.floorNumber : '—'} 
            />
            <Property 
              label="Site Images" 
              value={`${order.files?.length || 0} Uploaded`} 
            />
          </div>
        </div>

        {/* Remarks / Notes */}
        <div className={cardClasses}>
          <SectionTitle icon={MessageSquare} title="Order Remarks" />
          {order.remarks ? (
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
              {order.remarks}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">No additional remarks provided.</p>
          )}
        </div>

      </div>

      {/* Right Column (Narrower) */}
      <div className="space-y-6">
        
        {/* Personnel & Assignment */}
        <div className={cardClasses}>
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
          <SectionTitle icon={Users} title="Assignment" />
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Briefcase size={14} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Salesman</p>
                <p className="text-sm font-medium text-gray-900">{order.salesman?.name || 'Unassigned'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Phone size={14} className="text-cyan-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Calling Executive</p>
                <p className="text-sm font-medium text-gray-900">{order.callingExecutive?.name || 'Unassigned'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Building2 size={14} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-0.5">Sub-Vendor</p>
                <p className="text-sm font-medium text-gray-900">{order.subVendor?.name || 'In-House Execution'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
          <SectionTitle icon={Hash} title="Audit Trail" />
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Created By</span>
              <span className="font-medium text-gray-900">{order.createdBy?.name || 'System'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Created At</span>
              <span className="font-medium text-gray-900">
                {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {order.approvedBy && (
              <div className="flex justify-between items-center text-sm pt-3 border-t border-gray-200">
                <span className="text-gray-500">Approved By</span>
                <span className="font-medium text-gray-900">{order.approvedBy.name}</span>
              </div>
            )}
            {order.approvedAt && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Approved At</span>
                <span className="font-medium text-gray-900">
                  {new Date(order.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
