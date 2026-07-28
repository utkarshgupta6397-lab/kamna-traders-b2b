'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, ShieldAlert, Package, Layers, CheckCircle2, X, FileText, Database, Copy, ExternalLink, Activity, ChevronRight, ChevronDown, Download, Archive, RefreshCw, Image as ImageIcon, Box, User, Clock, Check, MoreVertical, Info } from 'lucide-react';
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
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center p-6">
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
  
  const isHighMargin = margin > 30; // Example rule
  const isSynced = false; // Mock

  return (
    <div className="min-h-screen bg-[#F4F6F8] pb-12 font-sans text-gray-900">
      
      {/* ─── ERP Hero Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          
          {/* Breadcrumbs & Top Actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <button onClick={() => router.push('/staff/dashboard/catalog-pricing/products')} className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft size={12} />
                Products
              </button>
              <ChevronRight size={12} className="text-gray-300" />
              <span className="text-gray-900">{product.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="h-8 px-3 text-[12px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm">
                <RefreshCw size={14} className="text-blue-600" />
                Sync Product
              </button>
              {canEdit && (
                <button 
                  onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/create?edit=${product.id}`)}
                  className="h-8 px-4 text-[12px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              )}
              
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                  className="h-8 w-8 flex items-center justify-center text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <MoreVertical size={16} />
                </button>
                
                {isActionsOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Copy size={14} className="text-gray-400" /> Duplicate
                    </button>
                    <button className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <Download size={14} className="text-gray-400" /> Export PDF
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <ExternalLink size={14} className="text-blue-500" /> View in Zoho Books
                    </button>
                    <button className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                      <ExternalLink size={14} className="text-indigo-500" /> View in Creator
                    </button>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button className="w-full text-left px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <Archive size={14} className="text-red-500" /> Archive Product
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Main Hero Content */}
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-lg border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-1">
              {product.thumbnailBase64 ? (
                <img src={product.thumbnailBase64} alt={product.name} className="w-full h-full object-contain rounded" />
              ) : (
                <Package size={32} className="text-gray-300" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-between h-24 py-0.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight truncate">{product.name}</h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <MasterStatusBadge status={product.status} />
                    <span className="font-mono text-[12px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{product.code}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${isGoods ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                      {isGoods ? 'Goods' : 'Service'}
                    </span>
                    {isHighMargin && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">High Margin</span>}
                    {isSynced ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={10} className="mr-1" /> Zoho Synced</span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-gray-100 text-gray-500 border border-gray-200"><Clock size={10} className="mr-1" /> Not Synced</span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600 font-mono tracking-tight leading-none">{formatCurrency(variant.sellingPrice || 0)}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1.5">Selling Price</div>
                </div>
              </div>
              
              {/* Dense Metrics Row */}
              <div className="flex items-center gap-6 text-[12px] mt-auto pb-1 overflow-x-auto whitespace-nowrap hide-scrollbar">
                <div className="flex items-center gap-1.5"><span className="text-gray-400 font-medium">Category:</span> <span className="font-semibold text-gray-700">{product.category?.name || '-'}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 font-medium">Brand:</span> <span className="font-semibold text-gray-700">{product.brand?.name || '-'}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 font-medium">Manufacturer:</span> <span className="font-semibold text-gray-700">{product.manufacturer?.name || '-'}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 font-medium">GST:</span> <span className="font-semibold text-gray-700">{product.taxRate?.percentage || 0}%</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 font-medium">HSN:</span> <span className="font-mono font-semibold text-gray-700">{product.hsnCode?.code || '-'}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400 font-medium">Inventory:</span> 
                  <span className={`font-semibold ${variant.trackInventory ? 'text-emerald-600' : 'text-gray-500'}`}>{variant.trackInventory ? 'Tracked' : 'Not Tracked'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Grid Layout ─────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ─── LEFT COLUMN (50%) ─── */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            
            {/* Basic Info */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <Info size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Basic Information</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Product Code / SKU</div>
                  <div className="text-[13px] font-mono font-medium text-gray-900">{product.code}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Product Type</div>
                  <div className="text-[13px] font-medium text-gray-900">{product.type}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</div>
                  {product.category ? (
                    <Link href={`/staff/dashboard/catalog-pricing/categories?view=${product.category.id}`} className="text-[13px] font-medium text-blue-600 hover:underline">{product.category.name}</Link>
                  ) : <div className="text-[13px] font-medium text-gray-900">-</div>}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Brand</div>
                  {product.brand ? (
                    <Link href={`/staff/dashboard/catalog-pricing/brands?view=${product.brand.id}`} className="text-[13px] font-medium text-blue-600 hover:underline">{product.brand.name}</Link>
                  ) : <div className="text-[13px] font-medium text-gray-900">-</div>}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Manufacturer</div>
                  {product.manufacturer ? (
                    <Link href={`/staff/dashboard/catalog-pricing/manufacturers?view=${product.manufacturer.id}`} className="text-[13px] font-medium text-blue-600 hover:underline">{product.manufacturer.name}</Link>
                  ) : <div className="text-[13px] font-medium text-gray-900">-</div>}
                </div>
                <div className="col-span-2 mt-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</div>
                  <div className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100">{product.description || 'No description provided.'}</div>
                </div>
              </div>
            </div>

            {/* Pricing & Margins */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-gray-500" />
                  <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Pricing & Margins</h3>
                </div>
                {product.incentiveTag && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">{product.incentiveTag}</span>
                )}
              </div>
              <div className="p-4 grid grid-cols-4 gap-4">
                <div className="col-span-2 bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Purchase Price</div>
                  <div className="text-[16px] font-bold text-gray-900 font-mono">{formatCurrency(variant.purchasePrice || 0)}</div>
                </div>
                <div className="col-span-2 bg-blue-50/50 rounded-lg p-3 border border-blue-100 shadow-sm">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Selling Price</div>
                  <div className="text-[16px] font-bold text-blue-700 font-mono">{formatCurrency(variant.sellingPrice || 0)}</div>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Gross Profit</div>
                  <div className={`text-[14px] font-bold font-mono ${grossProfit > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{formatCurrency(grossProfit)}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Margin %</div>
                  <div className={`text-[14px] font-bold ${margin > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{margin.toFixed(2)}%</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Markup %</div>
                  <div className={`text-[14px] font-bold ${markup > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>{markup.toFixed(2)}%</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tax Inclusive</div>
                  <div className="text-[13px] font-bold text-gray-900">{formatCurrency(variant.sellingPrice * (1 + (product.taxRate?.percentage || 0)/100))}</div>
                </div>
              </div>
            </div>

            {/* Gallery */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <ImageIcon size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Image Gallery</h3>
              </div>
              <div className="p-4 flex gap-4 overflow-x-auto">
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-blue-500 transition-colors cursor-pointer bg-gray-50/50">
                  <ImageIcon size={20} className="mb-1" />
                  <span className="text-[10px] font-bold uppercase">Add Image</span>
                </div>
              </div>
            </div>

          </div>

          {/* ─── MIDDLE COLUMN (25%) ─── */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            
            {/* Tax Info */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <FileText size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Tax & Units</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">HSN / SAC Code</div>
                  {product.hsnCode ? (
                    <div>
                      <Link href={`/staff/dashboard/catalog-pricing/hsn-codes?view=${product.hsnCode.id}`} className="text-[13px] font-mono font-medium text-blue-600 hover:underline">{product.hsnCode.code}</Link>
                      <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{product.hsnCode.name}</div>
                    </div>
                  ) : <div className="text-[13px] font-mono font-medium text-gray-900">-</div>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">GST Rate</div>
                    {product.taxRate ? (
                      <Link href={`/staff/dashboard/catalog-pricing/tax-rates?view=${product.taxRate.id}`} className="text-[13px] font-medium text-blue-600 hover:underline">{product.taxRate.percentage}%</Link>
                    ) : <div className="text-[13px] font-medium text-gray-900">-</div>}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Unit</div>
                    {product.unit ? (
                      <Link href={`/staff/dashboard/catalog-pricing/units?view=${product.unit.id}`} className="text-[13px] font-medium text-blue-600 hover:underline">{product.unit.abbreviation}</Link>
                    ) : <div className="text-[13px] font-medium text-gray-900">-</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <Box size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Inventory</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-gray-700">Track Inventory</span>
                  {variant.trackInventory ? (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-200">Enabled</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-200">Disabled</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-gray-700">Serial Tracking</span>
                  {variant.trackSerials ? (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-200">Enabled</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-200">Disabled</span>
                  )}
                </div>
              </div>
            </div>

            {/* Integrations */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <Database size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Integrations</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Zoho Books ID</div>
                  <div className="text-[13px] font-mono text-gray-400 italic">Not Synced</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Zoho Creator ID</div>
                  <div className="text-[13px] font-mono text-gray-400 italic">Not Synced</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Last Sync</div>
                  <div className="text-[13px] font-medium text-gray-500">-</div>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <User size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">System Info</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-[11px] font-medium text-gray-500">Created</span>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-gray-900">{product.createdBy?.name || 'System'}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{new Date(product.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {product.updatedBy && (
                  <div className="flex justify-between mt-2">
                    <span className="text-[11px] font-medium text-gray-500">Updated</span>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-gray-900">{product.updatedBy?.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{new Date(product.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-gray-100">
                  <span className="text-[11px] font-medium text-gray-500">Internal ID</span>
                  <span className="text-[10px] font-mono text-gray-400">{product.id.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] font-medium text-gray-500">Revision</span>
                  <span className="text-[11px] font-mono font-semibold text-gray-700">v{product.history?.length ? product.history.length + 1 : 1}.0</span>
                </div>
              </div>
            </div>

          </div>

          {/* ─── RIGHT COLUMN (25%) ─── */}
          <div className="lg:col-span-3 flex flex-col h-full">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col sticky top-36" style={{ height: 'calc(100vh - 160px)' }}>
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 shrink-0">
                <Activity size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Activity Timeline</h3>
              </div>
              <div className="p-4 overflow-y-auto flex-1 hide-scrollbar bg-[#FAFAFA]">
                {product.history && product.history.length > 0 ? (
                  <div className="relative border-l-2 border-gray-200 ml-2 space-y-5 py-2">
                    {product.history.map((h: any, idx: number) => (
                      <HistoryEventCard key={h.id || idx} h={h} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                    <Activity size={24} className="mb-2 opacity-20" />
                    <span className="text-[12px]">No activity recorded.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
