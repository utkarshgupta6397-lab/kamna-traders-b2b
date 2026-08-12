'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resolveProductImage } from '@/lib/utils';
import { ArrowLeft, Edit2, ShieldAlert, Package, Layers, CheckCircle2, X, FileText, Database, Copy, ExternalLink, Activity, ChevronRight, ChevronDown, Download, Archive, RefreshCw, Image as ImageIcon, Box, Boxes, User, Clock, Check, MoreVertical, Info, Trash2, UploadCloud, PlayCircle, PauseCircle } from 'lucide-react';
import MasterStatusBadge from '../../_framework/MasterStatusBadge';
import { HistoryEventCard } from '../../_framework/HistoryDrawer';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const ZohoBooksVariantPanel = dynamic(() => import('@/components/admin/ZohoBooksVariantPanel'), { ssr: false });

const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

let pdpRenderCount = 0;
let fetchProductCount = 0;
let fetchPermsCount = 0;

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  pdpRenderCount++;
  if (pdpRenderCount > 1) {
    console.warn(`[PROFILER] ProductDetailPage render count: ${pdpRenderCount}`);
  }
  const router = useRouter();
  const { id } = use(params);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<any>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineRemarks, setDeclineRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = 'target' in e ? e.target.files?.[0] : e;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        setProduct((prev: any) => ({ ...prev, thumbnailBase64: base64 }));
        const res = await fetch(`/api/staff/catalog/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbnailBase64: base64 })
        });
        if (!res.ok) throw new Error('Upload failed');
        toast.success('Image updated successfully');
      } catch (err: any) {
        toast.error(err.message || 'Error updating image');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProduct((prev: any) => ({ ...prev, thumbnailBase64: null }));
      const res = await fetch(`/api/staff/catalog/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailBase64: null })
      });
      if (!res.ok) throw new Error('Failed to remove image');
      toast.success('Image removed');
    } catch(err: any) {
      toast.error(err.message || 'Error removing image');
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const isCreator = permissions?.userId === product?.createdById;
    const isDraft = product?.status === 'Draft';
    const canEdit = permissions?.role === 'ADMIN' || permissions?.catalog_products_modify || (isCreator && isDraft && permissions?.catalog_products_create);
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };
  
  useEffect(() => {
    const fetchPerms = async () => {
      fetchPermsCount++;
      console.warn(`[PROFILER] fetchPerms called (${fetchPermsCount})`);
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.session);
      }
    };
    fetchPerms();
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      fetchProductCount++;
      console.warn(`[PROFILER] fetchProduct called (${fetchProductCount})`);
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

  const handleApprovalAction = async (action: 'approve' | 'decline') => {
    if (action === 'decline' && !declineRemarks.trim()) {
      toast.error('Remarks are required to decline.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks: declineRemarks })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      
      toast.success(`Product ${action}d successfully`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} product`);
    } finally {
      setIsSubmitting(false);
      setShowDeclineModal(false);
    }
  };

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
  const isCreator = permissions?.userId === product.createdById;
  const isDraft = product.status === 'Draft';
  
  const canEdit = permissions?.role === 'ADMIN' || permissions?.catalog_products_modify || (isCreator && isDraft && permissions?.catalog_products_create);
  const canApprove = permissions?.role === 'ADMIN' || permissions?.catalog_products_approve;
  const canSync = permissions?.role === 'ADMIN' || permissions?.catalog_products_sync;
  const canArchive = permissions?.role === 'ADMIN' || permissions?.catalog_products_archive;
  
  const isApprovalPending = product.status === 'Approval Pending';
  const isArchived = product.status === 'Archived';
  const isActive = product.status === 'Active';
  
  const isVariant = !!product.parentProductId;
  const showEdit = canEdit && !isApprovalPending && !isArchived;
  const showSync = canSync && isActive;
  const showArchive = canArchive && !isApprovalPending && !isArchived && !isVariant;
  const showRestore = canArchive && isArchived && !isVariant;
  const showSubmitForApproval = isDraft && (canEdit || isCreator) && !isVariant;
  
  const showZoho = !!product.zohoBooksId;
  const hasOverflowActions = showZoho || showArchive;
  
  const grossProfit = variant.sellingPrice - variant.purchasePrice;
  const margin = variant.sellingPrice > 0 ? (grossProfit / variant.sellingPrice) * 100 : 0;
  const markup = variant.purchasePrice > 0 ? (grossProfit / variant.purchasePrice) * 100 : 0;
  
  const isHighMargin = margin > 30; // Example rule
  const isSynced = variant.zohoSyncStatus === 'SYNCED';
  const isFamily = product.variantProducts && product.variantProducts.length > 0;

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
              {product.parentProduct && (
                <>
                  <ChevronRight size={12} className="text-gray-300" />
                  <Link href={`/staff/dashboard/catalog-pricing/products/${product.parentProduct.id}`} className="hover:text-blue-600 truncate max-w-[200px]" title={product.parentProduct.name}>
                    {product.parentProduct.name}
                  </Link>
                </>
              )}
              <ChevronRight size={12} className="text-gray-300" />
              <span className="text-gray-900 truncate max-w-[250px]" title={product.name}>{product.name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {showSync && (
                <button className="h-8 px-3 text-[12px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-sm">
                  <RefreshCw size={14} className="text-blue-600" />
                  Sync Product
                </button>
              )}
              
              {isApprovalPending && canApprove && (
                <>
                  <button 
                    onClick={() => handleApprovalAction('approve')}
                    disabled={isSubmitting}
                    className="h-8 px-3 text-[12px] font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button 
                    onClick={() => setShowDeclineModal(true)}
                    disabled={isSubmitting}
                    className="h-8 px-3 text-[12px] font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <X size={14} /> Decline
                  </button>
                </>
              )}
              
              {showEdit && !isVariant && (
                <button 
                  onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/create?edit=${product.id}`)}
                  className="h-8 px-4 text-[12px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Edit2 size={14} />
                  Edit Product
                </button>
              )}
              
              {(product.status === 'Active' || product.status === 'Inactive') && canEdit && (
                <button 
                  onClick={() => {
                    const isDeactivating = product.status === 'Active';
                    const newStatus = isDeactivating ? 'Inactive' : 'Active';
                    const msg = isDeactivating 
                      ? "Mark this product as Inactive? It will no longer be available for new transactions, quotations or orders until reactivated."
                      : "Reactivate this product? It will become available for new transactions immediately.";
                    if (confirm(msg)) {
                      fetch(`/api/staff/catalog/products/${product.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                      }).then(async res => {
                        const data = await res.json();
                        if (res.ok) {
                          setProduct({ ...product, status: newStatus });
                          if (data.zohoSyncError) {
                            alert(`ERP Status updated, but Zoho Sync failed: ${data.zohoSyncError}`);
                          }
                        } else {
                          alert(data.error || 'Failed to update status');
                        }
                      }).catch(() => alert('Network error while updating status'));
                    }
                  }}
                  className={`h-8 px-4 text-[12px] font-semibold text-white rounded-md flex items-center gap-1.5 transition-colors shadow-sm ${
                    product.status === 'Active' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {product.status === 'Active' ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                  {product.status === 'Active' ? 'Mark Inactive' : 'Mark Active'}
                </button>
              )}
              {isVariant && (
                <button 
                  onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${product.parentProductId}`)}
                  className="h-8 px-4 text-[12px] font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Layers size={14} />
                  View Product Family
                </button>
              )}
              
              {showSubmitForApproval && (
                <button 
                  onClick={() => handleApprovalAction('submit' as any)}
                  disabled={isSubmitting}
                  className="h-8 px-4 text-[12px] font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  Submit For Approval
                </button>
              )}
              
              {showRestore && (
                <button 
                  onClick={() => handleApprovalAction('reactivate' as any)}
                  disabled={isSubmitting}
                  className="h-8 px-4 text-[12px] font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  Restore Product
                </button>
              )}
              
              {hasOverflowActions && (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsActionsOpen(!isActionsOpen)}
                    className="h-8 w-8 flex items-center justify-center text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <MoreVertical size={16} />
                  </button>
                
                {isActionsOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    {showZoho && (
                      <>
                        <button className="w-full text-left px-3 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <ExternalLink size={14} className="text-blue-500" /> View in Zoho Books
                        </button>
                        {showArchive && <div className="h-px bg-gray-100 my-1"></div>}
                      </>
                    )}
                    {showArchive && (
                      <button 
                        onClick={() => handleApprovalAction('archive' as any)}
                        disabled={isSubmitting}
                        className="w-full text-left px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Archive size={14} className="text-red-500" /> Archive Product
                      </button>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
          
          {/* Main Hero Content */}
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-lg border border-gray-200 bg-white flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-1">
              {resolveProductImage(product) ? (
                <img src={resolveProductImage(product) || ''} alt={product.name} className="w-full h-full object-contain rounded" />
              ) : (
                <Package size={32} className="text-gray-300" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center h-24 py-0.5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight truncate">{product.name}</h1>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <MasterStatusBadge status={product.status} />
                    <span className="font-mono text-[12px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{product.code}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${isGoods ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                      {isGoods ? 'Goods' : 'Service'}
                    </span>
                    {isHighMargin && !isFamily && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">High Margin</span>}
                    {isFamily && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200"><Layers size={10} className="mr-1" /> Family Product</span>}
                    {isVariant && (
                      <Link href={`/staff/dashboard/catalog-pricing/products/${product.parentProductId}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer">
                        <Boxes size={10} className="mr-1" /> Variant
                      </Link>
                    )}
                    {!isFamily && variant.trackInventory ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200"><Box size={10} className="mr-1" /> Inventory Tracked</span>
                    ) : !isFamily && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-gray-100 text-gray-500 border border-gray-200"><Box size={10} className="mr-1" /> No Tracking</span>
                    )}
                    {isSynced ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={10} className="mr-1" /> Zoho Synced</span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-gray-100 text-gray-500 border border-gray-200"><Clock size={10} className="mr-1" /> Not Synced</span>
                    )}
                  </div>
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

            {/* Specifications (Dynamic Attributes) */}
            {product.attributeValues && product.attributeValues.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                  <Database size={14} className="text-gray-500" />
                  <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Specifications</h3>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {product.attributeValues.map((attrVal: any, idx: number) => {
                    const attr = attrVal.attribute;
                    if (!attr) return null;
                    return (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{attr.attributeName}</div>
                        <div className="text-[13px] font-medium text-gray-900">
                          {attr.prefix ? attr.prefix + ' ' : ''}
                          {attrVal.value}
                          {attr.suffix ? ' ' + attr.suffix : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pricing & Margins */}
            {!isFamily && (
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
            )}

            {/* Variant Summary Cards (Family Only) */}
            {isFamily && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-5">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                  <Layers size={14} className="text-gray-500" />
                  <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Variant Summary</h3>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const variants = product.variantProducts || [];
                    const prices = variants.map((vp: any) => vp.variants?.[0]?.sellingPrice || 0).filter((p: number) => p > 0);
                    const minPrice = prices.length ? Math.min(...prices) : 0;
                    const maxPrice = prices.length ? Math.max(...prices) : 0;
                    const avgPrice = prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
                    return (
                      <>
                        <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 shadow-sm">
                          <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Variants</div>
                          <div className="text-[16px] font-bold text-blue-700">{variants.length}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Lowest Price</div>
                          <div className="text-[16px] font-bold text-gray-900 font-mono">{formatCurrency(minPrice)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Highest Price</div>
                          <div className="text-[16px] font-bold text-gray-900 font-mono">{formatCurrency(maxPrice)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 shadow-sm">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Average Price</div>
                          <div className="text-[16px] font-bold text-gray-900 font-mono">{formatCurrency(avgPrice)}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Variants Table */}
            {isFamily && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-gray-500" />
                    <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Product Variants</h3>
                    <span className="ml-auto text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{product.variantProducts.length} Variants</span>
                  </div>
                  {product.status === 'Active' ? (
                    <button className="text-[12px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors">
                      + Add Variant
                    </button>
                  ) : null}
                </div>

                {product.status !== 'Active' && (
                  <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-start gap-3">
                    <ShieldAlert size={18} className="text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="text-[13px] font-bold text-orange-800">Approval Required</h4>
                      <p className="text-[12px] text-orange-700 mt-1">This Product Family must be approved by an administrator before you can add variants to it.</p>
                    </div>
                  </div>
                )}


                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-gray-50/50 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                      <tr>
                        <th className="px-4 py-3">Variant Name</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3 text-right">Purchase (₹)</th>
                        <th className="px-4 py-3 text-right">Selling (₹)</th>
                        <th className="px-4 py-3 text-center">Inv</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {product.variantProducts.map((vp: any, idx: number) => {
                        const vpVariant = vp.variants?.[0] || {};
                        return (
                          <tr 
                            key={idx} 
                            className="hover:bg-gray-50/30 cursor-pointer group"
                            onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${vp.id}`)}
                          >
                            <td className="px-4 py-3">
                              <div className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{vp.name}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">{product.variantAttribute?.attributeName}: {vp.variantAttributeValue}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-[12px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{vp.code}</span>
                            </td>
                            <td className="px-4 py-3 text-right text-[13px] font-medium text-gray-600">
                              {formatCurrency(vpVariant.purchasePrice || 0)}
                            </td>
                            <td className="px-4 py-3 text-right text-[13px] font-bold text-blue-600">
                              {formatCurrency(vpVariant.sellingPrice || 0)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {vpVariant.trackInventory ? <CheckCircle2 size={14} className="text-emerald-500 mx-auto"/> : <span className="text-gray-300 mx-auto">-</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <MasterStatusBadge status={vp.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Gallery */}
            {/* Gallery */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <ImageIcon size={14} className="text-gray-500" />
                <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Image Gallery</h3>
              </div>
              <div 
                className="p-4 flex gap-4 overflow-x-auto"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleImageUpload}
                />
                
                {resolveProductImage(product) ? (
                  <div className="relative group w-24 h-24 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                    <img src={resolveProductImage(product) || ''} alt="Product Thumbnail" className="w-full h-full object-cover" />
                    {canEdit && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded transition-colors"
                          title="Replace Image"
                        >
                          <UploadCloud size={14} />
                        </button>
                        <button 
                          onClick={handleRemoveImage}
                          className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded transition-colors"
                          title="Delete Image"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {canEdit && !resolveProductImage(product) && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer bg-gray-50/50 flex-shrink-0"
                  >
                    <ImageIcon size={20} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase">Add Image</span>
                  </div>
                )}
                
                {!canEdit && !resolveProductImage(product) && (
                  <div className="w-full h-24 flex items-center justify-center text-gray-400 text-[12px] italic">
                    No images available
                  </div>
                )}
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
            {!isFamily && (
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
            )}

            {/* Integrations */}
            {!isFamily && (
              <ZohoBooksVariantPanel 
                product={product} 
                variant={variant} 
                onSuccess={() => window.location.reload()} 
                canEdit={canEdit}
              />
            )}

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

      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Decline Product</h3>
            <p className="text-sm text-gray-500 mb-4">Please provide a reason for declining this product. The creator will be notified.</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              rows={4}
              placeholder="e.g., Margin is too low, please revise price."
              value={declineRemarks}
              onChange={(e) => setDeclineRemarks(e.target.value)}
            ></textarea>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={() => handleApprovalAction('decline')} disabled={isSubmitting || !declineRemarks.trim()} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Confirm Decline</button>
            </div>
          </div>
        </div>
      )}
      
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
