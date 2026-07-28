'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, ShieldAlert, Package, Layers, Info, CheckCircle2, X, FileText, Database, Copy, ExternalLink, Activity } from 'lucide-react';
import MasterStatusBadge from '../../_framework/MasterStatusBadge';
import { HistoryEventCard } from '../../_framework/HistoryDrawer';
import toast from 'react-hot-toast';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<any>(null);
  
  useEffect(() => {
    const fetchPerms = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const session = await res.json();
        setPermissions(session);
      }
    };
    fetchPerms();
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/staff/catalog/products/${id}`);
        if (!res.ok) throw new Error('Failed to fetch product');
        const data = await res.json();
        setProduct(data);
      } catch (e: any) {
        toast.error(e.message || 'Error loading product');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-6">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Product Not Found</h2>
        <button onClick={() => router.push('/staff/dashboard/catalog-pricing/products')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Return to Catalog
        </button>
      </div>
    );
  }

  const variant = product.variants?.[0] || {};
  const isGoods = product.type === 'Goods';
  const canEdit = permissions?.role === 'ADMIN' || permissions?.catalog_products_modify;
  
  const grossProfit = variant.sellingPrice - variant.purchasePrice;
  const margin = variant.sellingPrice > 0 ? (grossProfit / variant.sellingPrice) * 100 : 0;
  const markup = variant.purchasePrice > 0 ? (grossProfit / variant.purchasePrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24">
      {/* ─── Hero Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <button 
              onClick={() => router.push('/staff/dashboard/catalog-pricing/products')}
              className="mt-1 p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                {product.thumbnailBase64 ? (
                  <img src={product.thumbnailBase64} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={24} className="text-gray-300" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{product.name}</h1>
                  <MasterStatusBadge status={product.status} />
                </div>
                <div className="text-[13px] text-gray-500 flex items-center gap-3 mt-1.5">
                  <span className="font-mono font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">{product.code}</span>
                  <span>•</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${isGoods ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                    {isGoods ? <Package size={12} className="mr-1.5" /> : <Layers size={12} className="mr-1.5" />}
                    {product.type}
                  </span>
                  <span>•</span>
                  <span>{product.category?.name || 'Uncategorized'}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {canEdit && (
              <button 
                onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/create?edit=${product.id}`)}
                className="h-10 px-5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium text-[13.5px] transition-all shadow-sm inline-flex items-center gap-2"
              >
                <Edit2 size={16} /> Edit Product
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Grid Layout ──────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 50% - Primary Info */}
          <div className="lg:col-span-6 space-y-8">
            
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Info size={18} className="text-blue-500" />
                <h3 className="font-semibold text-gray-900">Basic Information</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 grid grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</label>
                  <div className="mt-1.5 text-[14px] text-gray-900 font-medium">{product.brand?.name || '-'}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manufacturer</label>
                  <div className="mt-1.5 text-[14px] text-gray-900 font-medium">{product.manufacturer?.name || '-'}</div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</label>
                  <div className="mt-1.5 text-[14px] text-gray-900 font-medium">{product.category?.name || '-'}</div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</label>
                  <div className="mt-1.5 text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">{product.description || 'No description provided.'}</div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Layers size={18} className="text-purple-500" />
                <h3 className="font-semibold text-gray-900">Pricing & Margins</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Purchase Price</label>
                    <div className="mt-1.5 text-[15px] font-semibold text-gray-900 font-mono">{formatCurrency(variant.purchasePrice || 0)}</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selling Price</label>
                    <div className="mt-1.5 text-[15px] font-semibold text-blue-600 font-mono">{formatCurrency(variant.sellingPrice || 0)}</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Margin</label>
                    <div className="mt-1.5 text-[15px] font-semibold text-emerald-600">{margin.toFixed(1)}%</div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mark-up</label>
                    <div className="mt-1.5 text-[15px] font-semibold text-gray-900">{markup.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Incentive Classification</span>
                  <span className="text-[13px] font-semibold px-3 py-1 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-800">{product.incentiveTag || '-'}</span>
                </div>
              </div>
            </section>

          </div>

          {/* 25% - Metadata */}
          <div className="lg:col-span-3 space-y-8">
            
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FileText size={18} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">Tax Information</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">HSN / SAC Code</label>
                  <div className="mt-1.5 text-[14px] text-gray-900 font-mono font-medium">{product.hsnCode?.code || '-'}</div>
                  <div className="mt-1 text-xs text-gray-500">{product.hsnCode?.name}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tax Rate (GST)</label>
                  <div className="mt-1.5 text-[14px] text-gray-900 font-medium">{product.taxRate?.percentage}%</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unit of Measure</label>
                  <div className="mt-1.5 text-[14px] text-gray-900 font-medium">{product.unit?.name} ({product.unit?.abbreviation})</div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Package size={18} className="text-indigo-500" />
                <h3 className="font-semibold text-gray-900">Inventory</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-medium text-gray-700">Track Inventory</span>
                  {variant.trackInventory ? <CheckCircle2 size={18} className="text-emerald-500" /> : <X size={18} className="text-gray-300" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-medium text-gray-700">Track Serial Numbers</span>
                  {variant.trackSerials ? <CheckCircle2 size={18} className="text-emerald-500" /> : <X size={18} className="text-gray-300" />}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Database size={18} className="text-rose-500" />
                <h3 className="font-semibold text-gray-900">Integrations</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Zoho Books Item ID</label>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[14px] font-mono text-gray-400 italic">Not Synced</span>
                    <div className="flex gap-1 opacity-50">
                      <button className="p-1.5 rounded-md hover:bg-gray-100"><Copy size={14}/></button>
                      <button className="p-1.5 rounded-md hover:bg-gray-100"><ExternalLink size={14}/></button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Zoho Creator Item ID</label>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[14px] font-mono text-gray-400 italic">Not Synced</span>
                    <div className="flex gap-1 opacity-50">
                      <button className="p-1.5 rounded-md hover:bg-gray-100"><Copy size={14}/></button>
                      <button className="p-1.5 rounded-md hover:bg-gray-100"><ExternalLink size={14}/></button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* 25% - Activity Timeline */}
          <div className="lg:col-span-3 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-gray-600" />
                <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[calc(100vh-200px)] overflow-y-auto">
                {product.history && product.history.length > 0 ? (
                  <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                    {product.history.map((h: any, idx: number) => (
                      <HistoryEventCard key={h.id || idx} h={h} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    No activity recorded.
                  </div>
                )}
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
