'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, FileText, ShoppingCart, Receipt, CreditCard } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const SectionSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-6 bg-gray-200 rounded w-1/4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 rounded"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  </div>
);

function useZohoData(orderId: string, endpoint: string) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/zoho/${endpoint}`);
      const json = await res.json();
      
      // Keep track of the raw response for debugging
      setData({ _debug: { status: res.status, url: res.url, ...json }, ...json });

      if (!res.ok) {
        if (json.error === 'zoho_reauth_required') {
          throw new Error('REAUTH_REQUIRED');
        }
        throw new Error(json.error || 'Failed to load data');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId, endpoint]);

  return { data, error, loading, retry: fetchData };
}

export default function FinancialDashboardClient({ orderId, orgId }: { orderId: string, orgId: string }) {
  const customerApi = useZohoData(orderId, 'customer');
  const quotesApi = useZohoData(orderId, 'quotes');
  const salesOrdersApi = useZohoData(orderId, 'sales-orders');
  const invoicesApi = useZohoData(orderId, 'invoices');
  const paymentsApi = useZohoData(orderId, 'payments');

  const openInZoho = (module: string, id: string) => {
    window.open(`https://books.zoho.in/app/${orgId || ''}#/${module}/${id}`, '_blank');
  };

  const Card = ({ title, children, icon: Icon, error, retry, loading }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-gray-500" />}
          {title}
        </h3>
        {error && (
          <button onClick={retry} className="text-gray-400 hover:text-[#1A2766] transition-colors" title="Retry">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="p-4 flex-1 overflow-x-auto">
        {loading ? (
          <SectionSkeleton />
        ) : error && error !== 'REAUTH_REQUIRED' ? (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        ) : !loading && !error && (!children || (Array.isArray(children) && children.length === 0)) ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
             <div className="text-sm font-medium">No records found</div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (['paid', 'accepted', 'confirmed', 'invoiced'].includes(s)) return 'bg-green-100 text-green-700';
    if (['sent', 'open', 'partially_paid'].includes(s)) return 'bg-blue-100 text-blue-700';
    if (['overdue', 'declined', 'void'].includes(s)) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  const Badge = ({ status }: { status: string }) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${getStatusColor(status)}`}>
      {status || 'UNKNOWN'}
    </span>
  );

  const customer = customerApi.data?.contact;
  const kpis = {
    quotes: quotesApi.data?.quotes?.length || 0,
    salesOrders: salesOrdersApi.data?.salesorders?.length || 0,
    invoices: invoicesApi.data?.invoices?.length || 0,
    received: (paymentsApi.data?.payments || []).reduce((acc: number, p: any) => acc + p.amount, 0),
    outstanding: customer?.outstanding_receivable_amount || 0,
    invoiceTotal: (invoicesApi.data?.invoices || []).reduce((acc: number, i: any) => acc + i.total, 0)
  };

  const needsReauth = 
    customerApi.error === 'REAUTH_REQUIRED' || 
    quotesApi.error === 'REAUTH_REQUIRED' || 
    salesOrdersApi.error === 'REAUTH_REQUIRED' || 
    invoicesApi.error === 'REAUTH_REQUIRED' || 
    paymentsApi.error === 'REAUTH_REQUIRED';

  return (
    <div className="space-y-6">
      {needsReauth && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-md flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-orange-500 mr-3" />
            <p className="text-sm text-orange-700 font-medium">
              Zoho authorization needs to be refreshed because new permissions are required.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/api/zoho/connect'}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
          >
            Re-authorize Zoho
          </button>
        </div>
      )}

      {/* Debug Panel (Dev Only) */}
      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_ZOHO === 'true') && (
        <div className="bg-gray-900 rounded-xl p-4 text-xs font-mono text-green-400 overflow-x-auto shadow-inner border border-gray-800">
          <h3 className="text-white font-bold mb-3 uppercase tracking-wider text-[10px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> 
            Zoho Financials Debug Panel
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { name: 'Customer', api: customerApi },
              { name: 'Quotes', api: quotesApi },
              { name: 'Sales Orders', api: salesOrdersApi },
              { name: 'Invoices', api: invoicesApi },
              { name: 'Payments', api: paymentsApi }
            ].map(m => (
              <div key={m.name} className="bg-black/50 p-3 rounded-lg border border-gray-800">
                <div className="font-bold text-gray-300 mb-2 border-b border-gray-800 pb-1">{m.name}</div>
                <div className="space-y-1">
                  <div className="truncate"><span className="text-gray-500">Status:</span> {m.api.data?._debug?.status || 'ERR'}</div>
                  <div className="truncate"><span className="text-gray-500">Z-Code:</span> {m.api.data?._debug?.code ?? 'N/A'}</div>
                  <div className="truncate" title={m.api.data?._debug?.message || m.api.error}><span className="text-gray-500">Msg:</span> {m.api.data?._debug?.message || m.api.error || 'OK'}</div>
                  <div className="truncate"><span className="text-gray-500">Req:</span> {m.api.data?._debug?.url ? new URL(m.api.data._debug.url).pathname : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Quotations', value: kpis.quotes },
          { label: 'Sales Orders', value: kpis.salesOrders },
          { label: 'Invoices', value: kpis.invoices },
          { label: 'Total Invoiced', value: formatCurrency(kpis.invoiceTotal), highlight: true },
          { label: 'Total Received', value: formatCurrency(kpis.received), highlight: true, color: 'text-green-600' },
          { label: 'Outstanding', value: formatCurrency(kpis.outstanding), highlight: true, color: 'text-red-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
            <div className="text-xs text-gray-500 font-medium mb-1">{kpi.label}</div>
            <div className={`text-lg font-bold ${kpi.color || 'text-gray-900'}`}>
              {invoicesApi.loading ? <span className="animate-pulse bg-gray-200 h-6 w-16 block rounded"></span> : kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Customer Info (Left Col) */}
        <div className="space-y-6 lg:col-span-1">
          <Card title="Customer Information" loading={customerApi.loading} error={customerApi.error} retry={customerApi.retry}>
            {customer && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{customer.contact_name}</h4>
                  <p className="text-xs text-gray-500">{customer.company_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">GST Number</div>
                    <div className="text-sm font-medium">{customer.gst_no || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Customer Type</div>
                    <div className="text-sm font-medium">{customer.customer_sub_type || 'Business'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Phone</div>
                    <div className="text-sm font-medium">{customer.phone || customer.mobile || 'N/A'}</div>
                  </div>
                  <div className="truncate">
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="text-sm font-medium truncate" title={customer.email}>{customer.email || 'N/A'}</div>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Billing Address</div>
                  <div className="text-xs text-gray-700 leading-relaxed">
                    {customer.billing_address?.address || 'No billing address provided.'}
                    {customer.billing_address?.city && <><br/>{customer.billing_address.city}, {customer.billing_address.state}</>}
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-500">Unused Credits</div>
                    <div className="text-sm font-bold text-blue-600">{formatCurrency(customer.unused_credits_receivable_amount)}</div>
                  </div>
                  <button 
                    onClick={() => openInZoho('contacts', customer.contact_id)}
                    className="text-xs flex items-center gap-1 text-[#1A2766] hover:underline font-medium"
                  >
                    Open in Zoho <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Transactions (Right Col) */}
        <div className="lg:col-span-2 space-y-6">
          
          <Card title="Invoices" icon={Receipt} loading={invoicesApi.loading} error={invoicesApi.error} retry={invoicesApi.retry}>
            {invoicesApi.data?.invoices?.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No invoices found.</div>
            ) : (
              <table className="min-w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 font-medium">Invoice #</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Balance</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoicesApi.data?.invoices?.map((inv: any) => (
                    <tr key={inv.invoice_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-3 py-2 text-gray-500">{inv.date}</td>
                      <td className="px-3 py-2">{formatCurrency(inv.total)}</td>
                      <td className="px-3 py-2 font-medium text-red-600">{formatCurrency(inv.balance)}</td>
                      <td className="px-3 py-2"><Badge status={inv.status} /></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openInZoho('invoices', inv.invoice_id)} className="text-gray-400 hover:text-[#1A2766]">
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Payments Received" icon={CreditCard} loading={paymentsApi.loading} error={paymentsApi.error} retry={paymentsApi.retry}>
            {paymentsApi.data?.payments?.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No payments found.</div>
            ) : (
              <table className="min-w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 font-medium">Payment #</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Mode</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentsApi.data?.payments?.map((pmt: any) => (
                    <tr key={pmt.payment_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{pmt.payment_number}</td>
                      <td className="px-3 py-2 text-gray-500">{pmt.date}</td>
                      <td className="px-3 py-2">{pmt.payment_mode}</td>
                      <td className="px-3 py-2 font-medium text-green-600">{formatCurrency(pmt.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openInZoho('customerpayments', pmt.payment_id)} className="text-gray-400 hover:text-[#1A2766]">
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Sales Orders" icon={ShoppingCart} loading={salesOrdersApi.loading} error={salesOrdersApi.error} retry={salesOrdersApi.retry}>
              {salesOrdersApi.data?.salesorders?.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No sales orders.</div>
              ) : (
                <table className="min-w-full text-sm text-left">
                  <tbody className="divide-y divide-gray-100">
                    {salesOrdersApi.data?.salesorders?.map((so: any) => (
                      <tr key={so.salesorder_id} className="hover:bg-gray-50">
                        <td className="px-2 py-2">
                          <div className="font-medium text-gray-900">{so.salesorder_number}</div>
                          <div className="text-xs text-gray-500">{so.date}</div>
                        </td>
                        <td className="px-2 py-2 text-right">{formatCurrency(so.total)}</td>
                        <td className="px-2 py-2"><Badge status={so.status} /></td>
                        <td className="px-2 py-2 text-right">
                           <button onClick={() => openInZoho('salesorders', so.salesorder_id)} className="text-gray-400 hover:text-[#1A2766]">
                            <ExternalLink size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Quotations" icon={FileText} loading={quotesApi.loading} error={quotesApi.error} retry={quotesApi.retry}>
              {quotesApi.data?.quotes?.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No quotations.</div>
              ) : (
                <table className="min-w-full text-sm text-left">
                  <tbody className="divide-y divide-gray-100">
                    {quotesApi.data?.quotes?.map((q: any) => (
                      <tr key={q.estimate_id} className="hover:bg-gray-50">
                        <td className="px-2 py-2">
                          <div className="font-medium text-gray-900">{q.estimate_number}</div>
                          <div className="text-xs text-gray-500">{q.date}</div>
                        </td>
                        <td className="px-2 py-2 text-right">{formatCurrency(q.total)}</td>
                        <td className="px-2 py-2"><Badge status={q.status} /></td>
                        <td className="px-2 py-2 text-right">
                           <button onClick={() => openInZoho('quotes', q.estimate_id)} className="text-gray-400 hover:text-[#1A2766]">
                            <ExternalLink size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
