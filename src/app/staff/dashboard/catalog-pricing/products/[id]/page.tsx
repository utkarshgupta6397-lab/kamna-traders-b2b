'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Edit2, ShieldAlert, XCircle, History, Send, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../../_framework/MasterStatusBadge';
import ProductApprovalEngine from '../_components/ProductApprovalEngine';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'pricing' | 'history'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  
  // Action state
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; action: any }>({ isOpen: false, action: null });

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${id}`);
      if (!res.ok) throw new Error('Failed to fetch product');
      const data = await res.json();
      setProduct(data);
    } catch (e: any) {
      toast.error(e.message);
      router.push('/staff/dashboard/catalog-pricing/products');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          setPermissions(data.session);
        }
      })
      .catch(e => console.error(e));

    fetchProduct();
  }, [fetchProduct]);

  const defaultVariant = product?.variants?.find((v: any) => v.isDefault);

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Loading product details...</div>;
  }

  if (!product) return null;

  const isAdmin = permissions?.role === 'ADMIN';
  const hasCreate = isAdmin || permissions?.catalog_products_create;
  const hasModify = isAdmin || permissions?.catalog_products_modify;
  const hasApprove = isAdmin || permissions?.catalog_products_approve;
  const hasArchive = isAdmin || permissions?.catalog_products_archive;

  const canSubmitDraft = hasCreate || hasModify;

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/staff/dashboard/catalog-pricing/products')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
              <MasterStatusBadge status={product.status as any} />
            </div>
            <p className="text-sm text-gray-500 mt-1 font-mono">{product.code}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {product.status === 'Draft' && canSubmitDraft && (
            <button 
              onClick={() => setActionModal({ isOpen: true, action: 'submit' })}
              className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200"
            >
              <Send size={16} /> Submit for Approval
            </button>
          )}
          {product.status === 'Approval Pending' && hasApprove && (
            <>
              <button 
                onClick={() => setActionModal({ isOpen: true, action: 'decline' })}
                className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors border border-red-200"
              >
                <XCircle size={16} /> Decline
              </button>
              <button 
                onClick={() => setActionModal({ isOpen: true, action: 'approve' })}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <ShieldAlert size={16} /> Approve
              </button>
            </>
          )}
          {product.status === 'Active' && hasModify && (
            <button 
              onClick={() => setActionModal({ isOpen: true, action: 'deactivate' })}
              className="flex items-center gap-2 bg-white text-orange-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 border border-gray-300 transition-colors"
            >
              Deactivate
            </button>
          )}
          {(product.status === 'Inactive' || product.status === 'Draft') && hasArchive && (
            <button 
              onClick={() => setActionModal({ isOpen: true, action: 'archive' })}
              className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 border border-gray-300 transition-colors"
            >
              Archive
            </button>
          )}
          {product.status === 'Archived' && hasArchive && (
            <button 
              onClick={() => setActionModal({ isOpen: true, action: 'reactivate' })}
              className="flex items-center gap-2 bg-white text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 border border-gray-300 transition-colors"
            >
              Restore
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-6">
        {[
          { id: 'details', label: 'General & Compliance' },
          { id: 'pricing', label: 'Pricing & Inventory' },
          { id: 'history', label: 'Audit History' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'details' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">General Information</h3>
                {/* Note: In a complete implementation, this would switch to a form mode. For MVP view-only is sufficient, or we can add an Edit button later */}
              </div>
              <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Product Name</label>
                  <div className="text-sm text-gray-900 font-medium">{product.name}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <div className="text-sm text-gray-900">{product.description || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Brand</label>
                  <div className="text-sm text-gray-900">{product.brand?.name || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Category</label>
                  <div className="text-sm text-gray-900">{product.category?.name || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Manufacturer</label>
                  <div className="text-sm text-gray-900">{product.manufacturer?.name || '-'}</div>
                </div>
              </div>

              <div className="px-6 py-4 border-y border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Tax & Compliance</h3>
              </div>
              <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">HSN Code</label>
                  <div className="text-sm text-gray-900">{product.hsnCode?.code} {product.hsnCode?.name ? `(${product.hsnCode.name})` : ''}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tax Rate (GST)</label>
                  <div className="text-sm text-gray-900">{product.taxRate?.percentage ? `${product.taxRate.percentage}%` : '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Unit of Measurement</label>
                  <div className="text-sm text-gray-900">{product.unit?.abbreviation || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Pricing & Inventory (Default Variant)</h3>
              </div>
              {defaultVariant ? (
                <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Variant SKU</label>
                    <div className="text-sm text-gray-900 font-mono">{defaultVariant.sku}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Zoho Item ID</label>
                    <div className="text-sm text-gray-900">{defaultVariant.zohoBookItemId || 'Not Synced'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Purchase Price</label>
                    <div className="text-sm text-gray-900">₹{defaultVariant.purchasePrice?.toFixed(2)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Selling Price</label>
                    <div className="text-sm text-gray-900">₹{defaultVariant.sellingPrice?.toFixed(2)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Track Inventory</label>
                    <div className="text-sm text-gray-900">{defaultVariant.trackInventory ? 'Yes' : 'No'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Track Serials</label>
                    <div className="text-sm text-gray-900">{defaultVariant.trackSerials ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-gray-500 text-sm">No default variant found.</div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Audit History</h3>
              </div>
              <div className="p-0">
                {product.history?.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {product.history.map((h: any) => (
                      <div key={h.id} className="p-4 flex items-start gap-4 hover:bg-gray-50/50">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                          <History size={14} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{h.performedBy?.name || 'System'}</span> performed <span className="font-semibold text-blue-600">{h.action}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(h.performedAt).toLocaleString()}
                          </p>
                          {h.remarks && (
                            <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                              {h.remarks}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-gray-500 text-sm text-center">No history available.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ProductApprovalEngine 
        isOpen={actionModal.isOpen} 
        onClose={() => setActionModal({ isOpen: false, action: null })} 
        record={product} 
        action={actionModal.action} 
        onSuccess={fetchProduct} 
      />
    </div>
  );
}
