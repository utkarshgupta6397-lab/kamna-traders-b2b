'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, FileText, ShoppingCart, Receipt, CreditCard, CheckCircle2 } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const SectionSkeleton = () => (
  <div className="animate-pulse flex space-x-4 p-2">
    <div className="flex-1 space-y-3 py-1">
      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded"></div>
        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
      </div>
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

  const [globalRefreshing, setGlobalRefreshing] = useState(false);

  const handleGlobalRefresh = async () => {
    setGlobalRefreshing(true);
    await Promise.all([
      customerApi.retry(),
      quotesApi.retry(),
      salesOrdersApi.retry(),
      invoicesApi.retry(),
      paymentsApi.retry()
    ]);
    setGlobalRefreshing(false);
  };

  const openInZoho = (module: string, id: string) => {
    window.open(`https://books.zoho.in/app/${orgId || ''}#/${module}/${id}`, '_blank');
  };

  const Card = ({ title, children, icon: Icon, error, retry, loading, className = "" }: any) => (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col ${className}`}>
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-gray-500" />}
          {title}
        </h3>
        <button onClick={retry} disabled={loading} className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="p-0 flex-1 overflow-auto max-h-[300px]">
        {loading ? (
          <SectionSkeleton />
        ) : error && error !== 'REAUTH_REQUIRED' ? (
          <div className="flex items-center gap-2 text-red-500 text-xs p-3">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        ) : !loading && !error && (!children || (Array.isArray(children) && children.length === 0)) ? (
          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
             <div className="text-xs font-medium">No records found</div>
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
    return 'bg-gray-100 text-gray-600';
  };

  const Badge = ({ status }: { status: string }) => (
    <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(status)}`}>
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

  const paymentPercentage = kpis.invoiceTotal > 0 ? Math.min(Math.round((kpis.received / kpis.invoiceTotal) * 100), 100) : 0;

  return (
    <div className="space-y-4 max-w-full text-sm">
      
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800">Financials Dashboard</h2>
        <button 
          onClick={handleGlobalRefresh}
          disabled={globalRefreshing}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${globalRefreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {needsReauth && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded-r-md flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-orange-500 mr-2" />
            <p className="text-xs text-orange-700 font-medium">
              Zoho authorization needs to be refreshed because new permissions are required.
            </p>
          </div>
          <button 
            onClick={() => window.location.href = '/api/zoho/connect'}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded shadow-sm transition-colors"
          >
            Re-authorize
          </button>
        </div>
      )}

      {/* Debug Panel (Dev Only) */}
      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_ZOHO === 'true') && (
        <div className="bg-gray-900 rounded-lg p-3 text-[10px] font-mono text-green-400 overflow-x-auto shadow-inner border border-gray-800">
          <h3 className="text-white font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> 
            Zoho Financials Debug
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { name: 'Customer', api: customerApi },
              { name: 'Quotes', api: quotesApi },
              { name: 'Sales Orders', api: salesOrdersApi },
              { name: 'Invoices', api: invoicesApi },
              { name: 'Payments', api: paymentsApi }
            ].map(m => (
              <div key={m.name} className="bg-black/50 p-2 rounded border border-gray-800">
                <div className="font-bold text-gray-300 mb-1 border-b border-gray-800 pb-1">{m.name}</div>
                <div className="space-y-0.5">
                  <div className="truncate"><span className="text-gray-500">Status:</span> {m.api.data?._debug?.status || 'ERR'}</div>
                  <div className="truncate"><span className="text-gray-500">Z-Code:</span> {m.api.data?._debug?.code ?? 'N/A'}</div>
                  <div className="truncate" title={m.api.data?._debug?.message || m.api.error}><span className="text-gray-500">Msg:</span> {m.api.data?._debug?.message || m.api.error || 'OK'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* KPI Row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Quotations', value: kpis.quotes, api: quotesApi },
          { label: 'Sales Orders', value: kpis.salesOrders, api: salesOrdersApi },
          { label: 'Invoices', value: kpis.invoices, api: invoicesApi },
          { label: 'Total Invoiced', value: formatCurrency(kpis.invoiceTotal), api: invoicesApi },
          { label: 'Total Received', value: formatCurrency(kpis.received), color: 'text-green-600', api: paymentsApi },
          { label: 'Outstanding', value: formatCurrency(kpis.outstanding), color: 'text-red-600', api: customerApi },
        ].map((kpi, i) => (
          <div 
            key={i} 
            onClick={kpi.api.retry}
            className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-200 transition-colors group"
            title="Click to refresh"
          >
            <div className="text-[11px] text-gray-500 font-medium mb-0.5 flex justify-between items-center">
              {kpi.label}
              <RefreshCw className={`h-3 w-3 text-gray-300 group-hover:text-blue-400 ${kpi.api.loading ? 'animate-spin text-blue-400' : ''}`} />
            </div>
            <div className={`text-base font-bold ${kpi.color || 'text-gray-800'}`}>
              {kpi.api.loading ? <span className="animate-pulse bg-gray-200 h-5 w-12 block rounded"></span> : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Column: Customer Info */}
        <div className="space-y-4 lg:col-span-1">
          <Card title="Customer Information" loading={customerApi.loading} error={customerApi.error} retry={customerApi.retry}>
            {customer && (
              <div className="p-3 text-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 leading-tight">{customer.contact_name}</h4>
                    <p className="text-gray-500">{customer.company_name}</p>
                  </div>
                  <button onClick={() => openInZoho('contacts', customer.contact_id)} className="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded flex items-center gap-1 font-medium">
                    Zoho <ExternalLink size={10} />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-2 border-t border-gray-100">
                  <div><span className="text-gray-500 block text-[10px] uppercase">Phone</span>{customer.phone || customer.mobile || '-'}</div>
                  <div className="truncate" title={customer.email}><span className="text-gray-500 block text-[10px] uppercase">Email</span>{customer.email || '-'}</div>
                  <div><span className="text-gray-500 block text-[10px] uppercase">GST</span>{customer.gst_no || '-'}</div>
                  <div><span className="text-gray-500 block text-[10px] uppercase">Type</span>{customer.customer_sub_type || 'Business'}</div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <span className="text-gray-500 block text-[10px] uppercase mb-0.5">Billing Address</span>
                  <div className="text-gray-700 leading-snug">
                    {customer.billing_address?.address || 'No billing address.'}
                    {customer.billing_address?.city && ` ${customer.billing_address.city}, ${customer.billing_address.state}`}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-gray-500 text-[10px] uppercase">Unused Credits</span>
                  <span className="font-bold text-blue-600 text-sm">{formatCurrency(customer.unused_credits_receivable_amount)}</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Chart & Invoices */}
        <div className="space-y-4 lg:col-span-2">
          
          {/* Payment Progress Chart */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Payment Progress</h3>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className="font-bold text-green-600">{formatCurrency(kpis.received)}</span> Collected vs <span className="font-medium text-gray-700">{formatCurrency(kpis.invoiceTotal)}</span> Total
                </div>
              </div>
              <div className="text-xl font-black text-gray-800">{paymentPercentage}%</div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
              <div 
                className={`h-full rounded-full ${paymentPercentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                style={{ width: `${paymentPercentage}%`, transition: 'width 1s ease-in-out' }}
              ></div>
            </div>
          </div>

          <Card title="Invoices" icon={Receipt} loading={invoicesApi.loading} error={invoicesApi.error} retry={invoicesApi.retry}>
            {invoicesApi.data?.invoices?.length > 0 && (
              <table className="w-full text-xs text-left">
                <thead className="text-gray-500 bg-gray-50/80 sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-1.5 font-semibold">Invoice #</th>
                    <th className="px-3 py-1.5 font-semibold">Date</th>
                    <th className="px-3 py-1.5 font-semibold">Amount</th>
                    <th className="px-3 py-1.5 font-semibold">Balance</th>
                    <th className="px-3 py-1.5 font-semibold">Status</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoicesApi.data.invoices.map((inv: any) => (
                    <tr key={inv.invoice_id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-3 py-2 font-medium text-gray-800">{inv.invoice_number}</td>
                      <td className="px-3 py-2 text-gray-500">{inv.date}</td>
                      <td className="px-3 py-2 font-medium">{formatCurrency(inv.total)}</td>
                      <td className="px-3 py-2 font-semibold text-red-600">{formatCurrency(inv.balance)}</td>
                      <td className="px-3 py-2"><Badge status={inv.status} /></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => openInZoho('invoices', inv.invoice_id)} className="text-gray-400 hover:text-blue-600">
                          <ExternalLink size={12} />
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

      {/* Bottom Section: Payments, SO, Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        <Card title="Payments Received" icon={CreditCard} loading={paymentsApi.loading} error={paymentsApi.error} retry={paymentsApi.retry} className="lg:col-span-2">
          {paymentsApi.data?.payments?.length > 0 && (
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500 bg-gray-50/80 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Payment #</th>
                  <th className="px-3 py-1.5 font-semibold">Date</th>
                  <th className="px-3 py-1.5 font-semibold">Mode</th>
                  <th className="px-3 py-1.5 font-semibold">Amount</th>
                  <th className="px-3 py-1.5 font-semibold">Verification</th>
                  <th className="px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentsApi.data.payments.map((pmt: any) => (
                  <tr key={pmt.payment_id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-gray-800">{pmt.payment_number}</td>
                    <td className="px-3 py-2 text-gray-500">{pmt.date}</td>
                    <td className="px-3 py-2 text-gray-600">{pmt.payment_mode}</td>
                    <td className="px-3 py-2 font-bold text-green-600">{formatCurrency(pmt.amount)}</td>
                    <td className="px-3 py-2">
                      {pmt.cf_is_verified ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium text-[10px] uppercase bg-green-50 px-1.5 py-0.5 rounded w-fit">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => openInZoho('customerpayments', pmt.payment_id)} className="text-gray-400 hover:text-blue-600">
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Sales Orders" icon={ShoppingCart} loading={salesOrdersApi.loading} error={salesOrdersApi.error} retry={salesOrdersApi.retry}>
          {salesOrdersApi.data?.salesorders?.length > 0 && (
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500 bg-gray-50/80 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">SO #</th>
                  <th className="px-3 py-1.5 font-semibold">Date</th>
                  <th className="px-3 py-1.5 font-semibold">Amount</th>
                  <th className="px-3 py-1.5 font-semibold">Status</th>
                  <th className="px-3 py-1.5 font-semibold">Invoiced</th>
                  <th className="px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesOrdersApi.data.salesorders.map((so: any) => (
                  <tr key={so.salesorder_id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-gray-800">{so.salesorder_number}</td>
                    <td className="px-3 py-2 text-gray-500">{so.date}</td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(so.total)}</td>
                    <td className="px-3 py-2"><Badge status={so.status} /></td>
                    <td className="px-3 py-2"><Badge status={so.invoiced_status} /></td>
                    <td className="px-3 py-2 text-right">
                       <button onClick={() => openInZoho('salesorders', so.salesorder_id)} className="text-gray-400 hover:text-blue-600">
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Quotations" icon={FileText} loading={quotesApi.loading} error={quotesApi.error} retry={quotesApi.retry}>
          {quotesApi.data?.quotes?.length > 0 && (
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500 bg-gray-50/80 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Quote #</th>
                  <th className="px-3 py-1.5 font-semibold">Date</th>
                  <th className="px-3 py-1.5 font-semibold">Amount</th>
                  <th className="px-3 py-1.5 font-semibold">Expiry</th>
                  <th className="px-3 py-1.5 font-semibold">Status</th>
                  <th className="px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotesApi.data.quotes.map((q: any) => (
                  <tr key={q.estimate_id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-gray-800">{q.estimate_number}</td>
                    <td className="px-3 py-2 text-gray-500">{q.date}</td>
                    <td className="px-3 py-2 font-medium">{formatCurrency(q.total)}</td>
                    <td className="px-3 py-2 text-gray-500">{q.expiry_date || '-'}</td>
                    <td className="px-3 py-2"><Badge status={q.status} /></td>
                    <td className="px-3 py-2 text-right">
                       <button onClick={() => openInZoho('quotes', q.estimate_id)} className="text-gray-400 hover:text-blue-600">
                        <ExternalLink size={12} />
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
  );
}
