'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resolveProductImage } from '@/lib/utils';
import { ArrowLeft, Edit2, ShieldAlert, Layers, CheckCircle2, X, FileText, ExternalLink, Activity, ChevronDown, Check, MoreVertical, Box, Clock, Image as ImageIcon, UploadCloud, Plus, Save, Wand2, Trash2 } from 'lucide-react';
import MasterStatusBadge from '../../_framework/MasterStatusBadge';
import { HistoryEventCard } from '../../_framework/HistoryDrawer';
import toast from 'react-hot-toast';
import { Select } from '@/components/ui/Select';
import ImportOrphanModal from './ImportOrphanModal';

const evaluateMath = (expr: string | number): string => {
  if (expr === undefined || expr === null || expr === '') return '';
  const strExpr = String(expr).trim();
  try {
    // Only allow digits, basic operators, and decimal points
    if (!/^[0-9+\-*/.\s()]+$/.test(strExpr)) return strExpr;
    // safe eval using Function
    const result = new Function('return ' + strExpr)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result.toFixed(2);
    }
  } catch (e) {
    // ignore parse errors
  }
  return strExpr;
};

export default function ProductFamilyDetailPageClient({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [permissions, setPermissions] = useState<any>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Inline edit/add state
  const [attributes, setAttributes] = useState<any[]>([]);
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [attributeValues, setAttributeValues] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineRemarks, setDeclineRemarks] = useState('');

  useEffect(() => {
    const fetchPerms = async () => {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.session);
      }
    };
    fetchPerms();
  }, []);

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

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product?.categoryId) {
      fetch(`/api/staff/catalog/categories/${product.categoryId}/attributes`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAttributes(data);
        })
        .catch(e => console.error('Error fetching attributes', e));
    }
  }, [product?.categoryId]);

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
        <h2 className="text-xl font-semibold text-gray-900">Product Family Not Found</h2>
        <button onClick={() => router.push('/staff/dashboard/catalog-pricing/products')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Return to Catalog
        </button>
      </div>
    );
  }

  const isCreator = permissions?.userId === product.createdById;
  const isDraft = product.status === 'Draft';
  
  const canEdit = permissions?.role === 'ADMIN' || permissions?.catalog_products_modify || (isCreator && isDraft && permissions?.catalog_products_create);
  const canApprove = permissions?.role === 'ADMIN' || permissions?.catalog_products_approve;
  
  const isApprovalPending = product.status === 'Approval Pending';
  const isActive = product.status === 'Active';
  
  const showEdit = canEdit && !isApprovalPending && product.status !== 'Archived';
  const showSubmitForApproval = isDraft && (canEdit || isCreator);
  
  const handleApprovalAction = async (action: 'approve' | 'decline' | 'submit') => {
    if (action === 'decline' && !declineRemarks.trim()) {
      toast.error('Remarks are required to decline.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks: declineRemarks })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
      
      toast.success(`Product family ${action}d successfully`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} product family`);
    } finally {
      setIsSubmitting(false);
      setShowDeclineModal(false);
    }
  };

  const childrenCount = product.variantProducts?.length || 0;
  const activeChildren = product.variantProducts?.filter((c:any) => c.status === 'Active').length || 0;
  const pendingChildren = product.variantProducts?.filter((c:any) => c.status === 'Approval Pending').length || 0;
  
  // Image Handlers
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
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  // INLINE EDIT LOGIC
  const startAddVariant = () => {
    setEditingVariantId(null);
    setFormData({
      name: '', code: '', purchasePrice: '', sellingPrice: '', trackInventory: true, trackSerials: false
    });
    setAttributeValues({});
    setIsAddingVariant(true);
  };

  const startEditVariant = (child: any) => {
    setIsAddingVariant(false);
    setEditingVariantId(child.id);
    setFormData({
      name: child.name || '', 
      code: child.code || '', 
      purchasePrice: child.variants?.[0]?.purchasePrice || '', 
      sellingPrice: child.variants?.[0]?.sellingPrice || '',
      trackInventory: child.variants?.[0]?.trackInventory ?? true,
      trackSerials: child.variants?.[0]?.trackSerials ?? false
    });
    const attrVals: any = {};
    child.attributeValues?.forEach((av: any) => {
      attrVals[av.attributeId] = av.value;
    });
    setAttributeValues(attrVals);
  };

  const handleCancelInline = () => {
    setIsAddingVariant(false);
    setEditingVariantId(null);
  };

  const handleGenerateSku = async () => {
    setIsGeneratingSku(true);
    try {
      const res = await fetch('/api/staff/catalog/products/generate-sku');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate SKU');
      setFormData((prev: any) => ({ ...prev, code: data.sku }));
      toast.success(`SKU generated: ${data.sku}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGeneratingSku(false);
    }
  };

  const handleSaveInline = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        productType: 'single',
        parentProductId: product.id,
        name: formData.name,
        code: formData.code,
        purchasePrice: formData.purchasePrice,
        sellingPrice: formData.sellingPrice,
        trackInventory: formData.trackInventory,
        trackSerials: formData.trackSerials,
        productAttributes: Object.keys(attributeValues).map(key => ({
          attributeId: key,
          value: attributeValues[key]
        }))
      };

      let res;
      if (isAddingVariant) {
        res = await fetch('/api/staff/catalog/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`/api/staff/catalog/products/${editingVariantId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isAddingVariant ? 'create' : 'update'} product`);
      
      toast.success(`Product ${isAddingVariant ? 'created' : 'updated'} successfully`);
      setIsAddingVariant(false);
      setEditingVariantId(null);
      fetchProduct();
    } catch (e: any) {
      toast.error(e.message || `Error ${isAddingVariant ? 'creating' : 'updating'} product`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVariantAction = async (variantId: string, action: 'submit' | 'approve' | 'decline' | 'delete') => {
    let remarks = '';
    if (action === 'decline') {
      const input = window.prompt('Please enter remarks for declining this variant:');
      if (input === null) return;
      if (!input.trim()) {
        toast.error('Remarks are required to decline.');
        return;
      }
      remarks = input;
    }
    
    setIsSubmitting(true);
    try {
      if (action === 'delete') {
        if (!window.confirm('Are you sure you want to delete this variant?')) {
          setIsSubmitting(false);
          return;
        }
        const res = await fetch(`/api/staff/catalog/products/${variantId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete variant');
        toast.success('Variant deleted successfully');
      } else {
        const res = await fetch(`/api/staff/catalog/products/${variantId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, remarks })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to ${action} variant`);
        toast.success(`Variant ${action}d successfully`);
      }
      fetchProduct();
    } catch (e: any) {
      toast.error(e.message || `Failed to ${action} variant`);
    } finally {
      setIsSubmitting(false);
    }
  };



  // Keyboard navigation for spreadsheet experience
  const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // On enter, trigger blur manually to evaluate math if on price, then save row
      if (fieldName === 'purchasePrice' || fieldName === 'sellingPrice') {
         setFormData((prev: any) => ({ ...prev, [fieldName]: evaluateMath(prev[fieldName]) }));
      }
      setTimeout(() => handleSaveInline(), 0);
    }
  };

  const handlePriceBlur = (field: 'purchasePrice' | 'sellingPrice') => {
    setFormData((prev: any) => ({ ...prev, [field]: evaluateMath(prev[field]) }));
  };

  const renderInlineRow = (isEditMode: boolean, existingItem?: any) => (
    <tr className="bg-blue-50/50 shadow-sm">
      {/* Product Name - FROZEN */}
      <td style={{ minWidth: 320, width: 320, position: 'sticky', left: 0, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className="px-4 py-3 bg-blue-50 align-top">
        <input 
          type="text" 
          placeholder="Product Name" 
          value={formData.name} 
          onChange={e => setFormData({ ...formData, name: e.target.value })} 
          onKeyDown={e => handleKeyDown(e, 'name')}
          className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
        />
      </td>
      {/* SKU - FROZEN */}
      <td style={{ minWidth: 180, width: 180, position: 'sticky', left: 320, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className="px-4 py-3 bg-blue-50 align-top">
        <div className="relative">
          <input 
            type="text" 
            placeholder="SKU" 
            value={formData.code} 
            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
            onKeyDown={e => handleKeyDown(e, 'code')}
            className="w-full text-sm pl-3 pr-8 py-2 border border-gray-300 rounded uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
          />
          <button 
            onClick={handleGenerateSku} 
            disabled={isGeneratingSku}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 focus:text-blue-600 transition-colors"
            title="Generate SKU"
          >
            {isGeneratingSku ? <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" /> : <Wand2 size={16} />}
          </button>
        </div>
      </td>
      
      {/* Dynamic Attributes */}
      {attributes.map(attr => (
        <td key={attr.id} style={{ minWidth: 180, width: 180 }} className="px-4 py-3 align-top">
          {(attr.dataType === 'Dropdown' || attr.dataType === 'Multi Select') ? (
            <Select
              value={attributeValues[attr.id] || ''}
              onChange={val => setAttributeValues({ ...attributeValues, [attr.id]: val })}
              placeholder={`Select`}
              options={(attr.options || []).map((opt: string) => ({ label: opt, value: opt }))}
              className={`${attr.mandatory && !attributeValues[attr.id] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'} shadow-sm`}
            />
          ) : (attr.dataType === 'Boolean') ? (
            <Select
              value={attributeValues[attr.id] || ''}
              onChange={val => setAttributeValues({ ...attributeValues, [attr.id]: val })}
              placeholder="Select"
              options={[
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]}
              className={`${attr.mandatory && !attributeValues[attr.id] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'} shadow-sm`}
            />
          ) : (
            <div className="relative">
              {attr.prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{attr.prefix}</span>}
              <input
                type={attr.dataType === 'Number' || attr.dataType === 'Decimal' ? 'number' : attr.dataType === 'Date' ? 'date' : 'text'}
                className={`w-full ${attr.prefix ? 'pl-7' : 'pl-3'} ${attr.suffix ? 'pr-7' : 'pr-3'} py-2 text-sm border rounded outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm ${attr.mandatory && !attributeValues[attr.id] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'}`}
                placeholder={attr.placeholder || ''}
                value={attributeValues[attr.id] || ''}
                min={attr.minValue ?? undefined}
                max={attr.maxValue ?? undefined}
                step={attr.dataType === 'Decimal' ? '0.01' : '1'}
                onChange={e => setAttributeValues({ ...attributeValues, [attr.id]: e.target.value })}
                onKeyDown={e => handleKeyDown(e, `attr_${attr.id}`)}
              />
              {attr.suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{attr.suffix}</span>}
            </div>
          )}
        </td>
      ))}
      
      {/* Purchase Price */}
      <td style={{ minWidth: 140, width: 140 }} className="px-4 py-3 align-top text-right">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₹</span>
          <input 
            type="text" 
            placeholder="0.00" 
            value={formData.purchasePrice} 
            onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })} 
            onKeyDown={e => handleKeyDown(e, 'purchasePrice')}
            onBlur={() => handlePriceBlur('purchasePrice')}
            className="w-full text-sm pl-7 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm text-right" 
          />
        </div>
      </td>
      {/* Selling Price */}
      <td style={{ minWidth: 140, width: 140 }} className="px-4 py-3 align-top text-right">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">₹</span>
          <input 
            type="text" 
            placeholder="0.00" 
            value={formData.sellingPrice} 
            onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })} 
            onKeyDown={e => handleKeyDown(e, 'sellingPrice')}
            onBlur={() => handlePriceBlur('sellingPrice')}
            className="w-full text-sm pl-7 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm text-right" 
          />
        </div>
      </td>
      {/* Inventory */}
      <td style={{ minWidth: 100, width: 100 }} className="px-4 py-3 align-middle text-center">
        <input 
          type="checkbox" 
          checked={formData.trackInventory} 
          onChange={e => setFormData({ ...formData, trackInventory: e.target.checked })} 
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
        />
      </td>
      {/* Serials */}
      <td style={{ minWidth: 100, width: 100 }} className="px-4 py-3 align-middle text-center">
        <input 
          type="checkbox" 
          checked={formData.trackSerials} 
          onChange={e => setFormData({ ...formData, trackSerials: e.target.checked })} 
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
        />
      </td>
      {/* Status */}
      <td style={{ minWidth: 140, width: 140 }} className="px-4 py-3 align-top pt-4">
        {existingItem ? <MasterStatusBadge status={existingItem.status} /> : <span className="text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shadow-sm inline-block">Draft</span>}
      </td>
      {/* Actions */}
      <td style={{ minWidth: 120, width: 120, position: 'sticky', right: 0, zIndex: 10, borderLeft: '1px solid #E5E7EB' }} className="px-4 py-3 bg-blue-50 align-top text-right">
        <div className="flex justify-end gap-1.5 mt-0.5">
          <button onClick={handleCancelInline} disabled={isSubmitting} className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg border border-transparent hover:border-red-200 bg-transparent hover:bg-red-50 disabled:opacity-50 transition-all flex items-center justify-center" title="Cancel">
            <X size={18} />
          </button>
          <button onClick={handleSaveInline} disabled={isSubmitting} className="text-white p-1.5 rounded-lg border border-transparent bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center font-medium" title="Save Row">
            <Check size={18} />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-[#F4F6F8] pb-12 font-inter">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/staff/dashboard/catalog-pricing/products')} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{product.name}</h1>
                  <MasterStatusBadge status={product.status} />
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 flex items-center gap-1.5 border border-indigo-200 shadow-sm">
                    <Layers size={14} /> Product Family
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-500 space-x-4">
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{product.code}</span>
                  <span className="text-xs">Created {new Date(product.createdAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
                    <Box size={14} />
                    <span>{childrenCount} Products</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {showSubmitForApproval && (
                <button onClick={() => handleApprovalAction('submit')} className="px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition-colors shadow-sm flex items-center">
                  <CheckCircle2 size={16} className="mr-2" /> Submit for Approval
                </button>
              )}
              {isApprovalPending && canApprove && (
                <>
                  <button onClick={() => handleApprovalAction('approve')} className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center">
                    <Check size={16} className="mr-2" /> Approve
                  </button>
                  <button onClick={() => setShowDeclineModal(true)} className="px-4 py-2 bg-white border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors flex items-center">
                    <X size={16} className="mr-2" /> Decline
                  </button>
                </>
              )}
              {showEdit && (
                <button onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${id}/edit-family`)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center">
                  <Edit2 size={16} className="mr-2" /> Edit Family
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TOP / MIDDLE ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          
          {/* LEFT COLUMN: PRODUCTS WORKSPACE (75%) */}
          <div className="lg:col-span-9 flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full relative">
              <div className="px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-center sticky top-0 z-20">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Box size={20} className="mr-2 text-indigo-600" /> Products Workspace
                </h2>
                <div className="flex gap-3">
                  <button onClick={() => setIsImportModalOpen(true)} disabled={!isActive} className={`px-4 py-2 font-medium rounded-lg text-sm flex items-center shadow-sm transition-all ${isActive ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-indigo-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                    <Box size={16} className="mr-2" /> Import Product
                  </button>
                  <button onClick={startAddVariant} disabled={!isActive || isAddingVariant || editingVariantId !== null} className={`px-4 py-2 font-medium rounded-lg text-sm flex items-center shadow-sm transition-all ${isActive && !isAddingVariant && !editingVariantId ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                    <Plus size={16} className="mr-2" /> Add Row
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto w-full relative" style={{ maxWidth: '100vw' }}>
                <table className="min-w-max w-full divide-y divide-gray-200 border-b border-gray-200">
                  <thead className="bg-gray-50/90 backdrop-blur-sm shadow-sm sticky top-0 z-20">
                    <tr>
                      <th style={{ minWidth: 320, width: 320, position: 'sticky', left: 0, zIndex: 30, borderRight: '1px solid #E5E7EB' }} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        Product Name
                      </th>
                      <th style={{ minWidth: 180, width: 180, position: 'sticky', left: 320, zIndex: 30, borderRight: '1px solid #E5E7EB' }} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        SKU
                      </th>
                      {attributes.map(attr => (
                        <th key={attr.id} style={{ minWidth: 180, width: 180 }} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                          {attr.attributeName} {attr.mandatory && <span className="text-red-500">*</span>}
                        </th>
                      ))}
                      <th style={{ minWidth: 140, width: 140 }} className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Purchase Price
                      </th>
                      <th style={{ minWidth: 140, width: 140 }} className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Selling Price
                      </th>
                      <th style={{ minWidth: 100, width: 100 }} className="px-4 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Inventory
                      </th>
                      <th style={{ minWidth: 100, width: 100 }} className="px-4 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Serials
                      </th>
                      <th style={{ minWidth: 140, width: 140 }} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th style={{ minWidth: 120, width: 120, position: 'sticky', right: 0, zIndex: 30, borderLeft: '1px solid #E5E7EB' }} className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {product.variantProducts?.map((child: any) => {
                      if (editingVariantId === child.id) {
                        return React.cloneElement(renderInlineRow(true, child), { key: child.id });
                      }
                      
                      return (
                        <tr key={child.id} className="hover:bg-gray-50/80 transition-colors group">
                          {/* Product Name - FROZEN */}
                          <td style={{ minWidth: 320, width: 320, position: 'sticky', left: 0, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className="px-4 py-4 text-sm font-medium text-gray-900 bg-white group-hover:bg-gray-50/80 transition-colors">
                            {child.name}
                          </td>
                          {/* SKU - FROZEN */}
                          <td style={{ minWidth: 180, width: 180, position: 'sticky', left: 320, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className="px-4 py-4 text-sm text-gray-600 font-mono bg-white group-hover:bg-gray-50/80 transition-colors">
                            <span className="bg-gray-100/80 border border-gray-200 px-2 py-1 rounded">{child.code}</span>
                          </td>
                          
                          {/* Dynamic Attributes */}
                          {attributes.map(attr => {
                            const val = child.attributeValues?.find((a: any) => a.attributeId === attr.id)?.value;
                            return (
                              <td key={attr.id} style={{ minWidth: 180, width: 180 }} className="px-4 py-4 text-sm text-gray-600 truncate">
                                {val || <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                          
                          <td style={{ minWidth: 140, width: 140 }} className="px-4 py-4 text-sm text-gray-600 text-right">
                            ₹{child.variants?.[0]?.purchasePrice?.toFixed(2) || '—'}
                          </td>
                          <td style={{ minWidth: 140, width: 140 }} className="px-4 py-4 text-sm text-gray-600 text-right">
                            ₹{child.variants?.[0]?.sellingPrice?.toFixed(2) || '—'}
                          </td>
                          <td style={{ minWidth: 100, width: 100 }} className="px-4 py-4 text-center">
                            {child.variants?.[0]?.trackInventory ? <CheckCircle2 size={16} className="text-green-500 mx-auto" /> : <X size={16} className="text-gray-300 mx-auto" />}
                          </td>
                          <td style={{ minWidth: 100, width: 100 }} className="px-4 py-4 text-center">
                            {child.variants?.[0]?.trackSerials ? <CheckCircle2 size={16} className="text-green-500 mx-auto" /> : <X size={16} className="text-gray-300 mx-auto" />}
                          </td>
                          <td style={{ minWidth: 140, width: 140 }} className="px-4 py-4 whitespace-nowrap">
                            <MasterStatusBadge status={child.status} />
                          </td>
                          <td style={{ minWidth: 120, width: 120, position: 'sticky', right: 0, zIndex: 10, borderLeft: '1px solid #E5E7EB' }} className="px-4 py-4 whitespace-nowrap text-right bg-white group-hover:bg-gray-50/80 transition-colors">
                            <div className="flex justify-end gap-1">
                              {child.status === 'Draft' || child.status === 'Declined' ? (
                                <>
                                  <button onClick={() => startEditVariant(child)} disabled={isAddingVariant || editingVariantId !== null} className={`p-1.5 text-gray-500 hover:text-indigo-600 rounded-md transition-colors ${isAddingVariant || editingVariantId !== null ? 'opacity-50 cursor-not-allowed' : ''}`} title="Edit Variant">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleVariantAction(child.id, 'submit')} disabled={isSubmitting || isAddingVariant || editingVariantId !== null} className="p-1.5 text-gray-500 hover:text-green-600 rounded-md transition-colors" title="Submit For Approval">
                                    <CheckCircle2 size={16} />
                                  </button>
                                  <button onClick={() => handleVariantAction(child.id, 'delete')} disabled={isSubmitting || isAddingVariant || editingVariantId !== null} className="p-1.5 text-gray-500 hover:text-red-600 rounded-md transition-colors" title="Delete Variant">
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              ) : child.status === 'Approval Pending' ? (
                                <>
                                  {canApprove && (
                                    <>
                                      <button onClick={() => handleVariantAction(child.id, 'approve')} disabled={isSubmitting} className="p-1.5 text-gray-500 hover:text-green-600 rounded-md transition-colors" title="Approve">
                                        <Check size={16} />
                                      </button>
                                      <button onClick={() => handleVariantAction(child.id, 'decline')} disabled={isSubmitting} className="p-1.5 text-gray-500 hover:text-red-600 rounded-md transition-colors" title="Decline">
                                        <X size={16} />
                                      </button>
                                    </>
                                  )}
                                  <button onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${child.id}`)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-md transition-colors" title="View Variant">
                                    <ExternalLink size={16} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditVariant(child)} disabled={isAddingVariant || editingVariantId !== null} className={`p-1.5 text-gray-500 hover:text-indigo-600 rounded-md transition-colors ${isAddingVariant || editingVariantId !== null ? 'opacity-50 cursor-not-allowed' : ''}`} title="Edit Variant inline">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${child.id}`)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-md transition-colors" title="View Variant details">
                                    <ExternalLink size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {isAddingVariant && renderInlineRow(false)}
                    
                    {!isAddingVariant && childrenCount === 0 && (
                      <tr>
                        <td colSpan={9 + attributes.length} className="px-6 py-16 text-center bg-gray-50 border-b border-gray-200">
                          <Box size={40} className="mx-auto text-gray-300 mb-3" />
                          <h3 className="text-sm font-medium text-gray-900">No products found</h3>
                          <p className="mt-1 text-sm text-gray-500">Click "Add Row" to start building your product matrix.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: FAMILY SUMMARY (25%) */}
          <div className="lg:col-span-3 flex flex-col space-y-6">
            
            {/* COMPLETENESS CHECKLIST */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                <CheckCircle2 size={18} className="text-green-500 mr-2" /> Completeness
              </h2>
              <div className="space-y-2">
                <div className={`flex items-center text-sm ${product.name ? 'text-green-700' : 'text-gray-400'}`}><Check size={16} className="mr-2"/> Basic Info</div>
                <div className={`flex items-center text-sm ${resolveProductImage(product) ? 'text-green-700' : 'text-gray-400'}`}><Check size={16} className="mr-2"/> Image</div>
                <div className={`flex items-center text-sm ${product.categoryId ? 'text-green-700' : 'text-gray-400'}`}><Check size={16} className="mr-2"/> Category</div>
                <div className={`flex items-center text-sm ${product.hsnCodeId ? 'text-green-700' : 'text-gray-400'}`}><Check size={16} className="mr-2"/> HSN Assigned</div>
                <div className={`flex items-center text-sm ${childrenCount > 0 ? 'text-green-700' : 'text-gray-400'}`}><Check size={16} className="mr-2"/> Products Added</div>
              </div>
            </div>

            {/* BASIC INFO */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
                <Layers size={16} className="text-gray-500 mr-2" />
                <h2 className="text-base font-semibold text-gray-900">Family Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div><p className="text-xs font-medium text-gray-500">Category</p><p className="mt-1 text-sm text-gray-900">{product.category?.name || '—'}</p></div>
                <div><p className="text-xs font-medium text-gray-500">Brand</p><p className="mt-1 text-sm text-gray-900">{product.brand?.name || '—'}</p></div>
                <div><p className="text-xs font-medium text-gray-500">Manufacturer</p><p className="mt-1 text-sm text-gray-900">{product.manufacturer?.name || '—'}</p></div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Incentive Category</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {product.incentiveTag ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        {product.incentiveTag}
                      </span>
                    ) : 'None'}
                  </p>
                </div>
              </div>
            </div>

            {/* TAX & LOGISTICS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
                <FileText size={16} className="text-gray-500 mr-2" />
                <h2 className="text-base font-semibold text-gray-900">Tax & Logistics</h2>
              </div>
              <div className="p-6 space-y-4">
                <div><p className="text-xs font-medium text-gray-500">HSN Code</p><p className="mt-1 text-sm text-gray-900">{product.hsnCode?.code || 'Not Assigned'}</p></div>
                <div><p className="text-xs font-medium text-gray-500">GST Rate</p><p className="mt-1 text-sm text-gray-900">{product.taxRate ? `${product.taxRate.percentage}%` : 'Not Assigned'}</p></div>
                <div><p className="text-xs font-medium text-gray-500">Unit of Measurement</p><p className="mt-1 text-sm text-gray-900">{product.unit ? (product.unit.name || product.unit.abbreviation) : 'Not Assigned'}</p></div>
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ACTIVITY TIMELINE */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <Activity size={16} className="text-gray-500 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">Activity Timeline</h3>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              {product.history && product.history.length > 0 ? (
                <div className="relative border-l-2 border-gray-200 ml-2 space-y-5 py-2">
                  {product.history.map((h: any, idx: number) => (
                    <HistoryEventCard key={h.id || idx} h={h} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                  <Activity size={32} className="mb-3 opacity-20" />
                  <span className="text-sm font-medium">No activity recorded.</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANELS (IMAGES & FUTURE) */}
          <div className="flex flex-col space-y-6 h-[400px]">
            {/* IMAGE GALLERY */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
                <ImageIcon size={16} className="text-gray-500 mr-2" />
                <h3 className="text-base font-semibold text-gray-900">Image Gallery</h3>
              </div>
              <div 
                className="p-6 flex gap-4 overflow-x-auto flex-1"
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
                  <div className="relative group w-32 h-32 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 shadow-sm">
                    <img src={resolveProductImage(product)} alt="Product Thumbnail" className="w-full h-full object-cover" />
                    {canEdit && (
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors"
                          title="Replace Image"
                        >
                          <UploadCloud size={16} />
                        </button>
                        <button 
                          onClick={handleRemoveImage}
                          className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors"
                          title="Delete Image"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {canEdit && !resolveProductImage(product) && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-32 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer flex-shrink-0 bg-gray-50/50"
                  >
                    <ImageIcon size={24} className="mb-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Add Image</span>
                  </div>
                )}
                
                {!canEdit && !resolveProductImage(product) && (
                  <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm italic">
                    No images available
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
      
      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Decline Product Family</h3>
              <button onClick={() => setShowDeclineModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Declining *</label>
              <textarea
                value={declineRemarks}
                onChange={e => setDeclineRemarks(e.target.value)}
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none text-[13px]"
                placeholder="Provide a reason for declining this product family..."
              ></textarea>
              <p className="text-xs text-gray-500 mt-2">This reason will be visible in the product's audit history.</p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowDeclineModal(false)} className="px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleApprovalAction('decline')} disabled={isSubmitting || !declineRemarks.trim()} className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">Decline Product Family</button>
            </div>
          </div>
        </div>
      )}

      <ImportOrphanModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        familyId={product?.id} 
        onSuccess={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
