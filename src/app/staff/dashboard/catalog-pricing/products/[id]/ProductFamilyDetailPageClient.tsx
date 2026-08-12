'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resolveProductImage } from '@/lib/utils';
import { ArrowLeft, Edit2, ShieldAlert, Layers, CheckCircle2, X, FileText, ExternalLink, Activity, ChevronDown, Check, MoreVertical, Box, Clock, Image as ImageIcon, UploadCloud, Plus, Save, Wand2, Trash2, Download, RefreshCw, Columns, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import MasterStatusBadge from '../../_framework/MasterStatusBadge';
import { HistoryEventCard } from '../../_framework/HistoryDrawer';
import toast from 'react-hot-toast';
import { Select } from '@/components/ui/Select';
import ImportOrphanModal from './ImportOrphanModal';

const AttributeValuePill = ({ value }: { value: string | null | undefined }) => {
  if (!value) return <span className="text-gray-300">—</span>;
  
  // Deterministic color selection
  const colors = [
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-indigo-50 text-indigo-700 border-indigo-200',
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-pink-50 text-pink-700 border-pink-200',
    'bg-teal-50 text-teal-700 border-teal-200',
    'bg-cyan-50 text-cyan-700 border-cyan-200',
    'bg-orange-50 text-orange-700 border-orange-200',
  ];
  
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${colors[colorIndex]}`}>
      {value}
    </span>
  );
};

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
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['zoho', 'inventory', 'updatedAt']));
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [visibilityMode, setVisibilityMode] = useState<'active' | 'all'>('active');
  type SortConfig = { key: string, direction: 'asc' | 'desc' } | null;
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colDropdownRef = useRef<HTMLDivElement>(null);
  
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
      if (colDropdownRef.current && !colDropdownRef.current.contains(event.target as Node)) {
        setIsColumnSelectorOpen(false);
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

  const renderInlineRow = (isEditMode: boolean, existingItem?: any, rowIndex?: number) => {
    const isInactive = existingItem?.status === 'Inactive';
    const trBg = isInactive ? 'bg-red-50/50' : 'bg-blue-50/40';
    const stickyBg = isInactive ? 'bg-red-50' : 'bg-[#f4f7fb]'; // match the trBg color roughly for sticky elements

    return (
      <tr className={`${trBg} shadow-sm group`}>
        {/* Index */}
        <td style={{ minWidth: 48, width: 48, position: 'sticky', left: 0, zIndex: 10 }} className={`px-2 py-3 text-center text-xs font-medium text-gray-500 ${stickyBg}`}>
          {rowIndex !== undefined ? rowIndex : ''}
        </td>
        {/* Thumbnail */}
        <td style={{ minWidth: 52, width: 52, position: 'sticky', left: 48, zIndex: 10 }} className={`px-4 py-3 text-center ${stickyBg}`}>
          {existingItem?.thumbnailBase64 ? (
            <img src={existingItem.thumbnailBase64} alt="Thumb" className="w-8 h-8 object-cover rounded-md border border-gray-200 shadow-sm mx-auto opacity-70" />
          ) : (
            <div className="w-8 h-8 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center mx-auto text-gray-400 opacity-70">
              <ImageIcon size={14} />
            </div>
          )}
        </td>
        {/* Product Name */}
        <td style={{ minWidth: 280, width: 280, position: 'sticky', left: 100, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className={`px-4 py-3 align-top ${stickyBg}`}>
          <input 
            type="text" 
            placeholder="Product Name" 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
            onKeyDown={e => handleKeyDown(e, 'name')}
            className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
          />
        </td>
        {/* SKU */}
        <td style={{ minWidth: 160, width: 160, position: 'sticky', left: 380, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className={`px-4 py-3 align-top ${stickyBg}`}>
          <div className="relative">
            <input 
              type="text" 
              placeholder="SKU" 
              value={formData.code} 
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
              onKeyDown={e => handleKeyDown(e, 'code')}
              className="w-full text-sm pl-2 pr-7 py-1.5 border border-gray-300 rounded uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm" 
            />
            <button 
              onClick={handleGenerateSku} 
              disabled={isGeneratingSku}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 focus:text-blue-600 transition-colors"
              title="Generate SKU"
            >
              {isGeneratingSku ? <div className="h-3 w-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" /> : <Wand2 size={14} />}
            </button>
          </div>
        </td>
        
        {/* Dynamic Attributes */}
        {attributes.map(attr => (
          <td key={attr.id} style={{ minWidth: 160, width: 160 }} className="px-4 py-3 align-top">
            {(attr.dataType === 'Dropdown' || attr.dataType === 'Multi Select') ? (
              <Select
                value={attributeValues[attr.id] || ''}
                onChange={val => setAttributeValues({ ...attributeValues, [attr.id]: val })}
                placeholder={`Select`}
                options={(attr.options || []).map((opt: string) => ({ label: opt, value: opt }))}
                className={`${attr.mandatory && !attributeValues[attr.id] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'} shadow-sm text-sm`}
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
                className={`${attr.mandatory && !attributeValues[attr.id] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'} shadow-sm text-sm`}
              />
            ) : (
              <div className="relative">
                {attr.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{attr.prefix}</span>}
                <input
                  type={attr.dataType === 'Number' || attr.dataType === 'Decimal' ? 'number' : attr.dataType === 'Date' ? 'date' : 'text'}
                  className={`w-full ${attr.prefix ? 'pl-6' : 'pl-2'} ${attr.suffix ? 'pr-6' : 'pr-2'} py-1.5 text-sm border rounded outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm ${attr.mandatory && !attributeValues[attr.id] ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300'}`}
                  placeholder={attr.placeholder || ''}
                  value={attributeValues[attr.id] || ''}
                  min={attr.minValue ?? undefined}
                  max={attr.maxValue ?? undefined}
                  step={attr.dataType === 'Decimal' ? '0.01' : '1'}
                  onChange={e => setAttributeValues({ ...attributeValues, [attr.id]: e.target.value })}
                  onKeyDown={e => handleKeyDown(e, `attr_${attr.id}`)}
                />
                {attr.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{attr.suffix}</span>}
              </div>
            )}
          </td>
        ))}
        
        {/* Purchase Price */}
        <td style={{ minWidth: 130, width: 130 }} className="px-4 py-3 align-top text-right">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-xs">₹</span>
            <input 
              type="text" 
              placeholder="0.00" 
              value={formData.purchasePrice} 
              onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })} 
              onKeyDown={e => handleKeyDown(e, 'purchasePrice')}
              onBlur={() => handlePriceBlur('purchasePrice')}
              className="w-full text-sm pl-5 pr-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm text-right" 
            />
          </div>
        </td>
        {/* Selling Price */}
        <td style={{ minWidth: 130, width: 130 }} className="px-4 py-3 align-top text-right">
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-xs">₹</span>
            <input 
              type="text" 
              placeholder="0.00" 
              value={formData.sellingPrice} 
              onChange={e => setFormData({ ...formData, sellingPrice: e.target.value })} 
              onKeyDown={e => handleKeyDown(e, 'sellingPrice')}
              onBlur={() => handlePriceBlur('sellingPrice')}
              className="w-full text-sm pl-5 pr-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm text-right" 
            />
          </div>
        </td>
        {/* Status */}
        <td style={{ minWidth: 130, width: 130 }} className="px-4 py-3 align-middle text-left whitespace-nowrap">
          {existingItem ? <MasterStatusBadge status={existingItem.status} /> : <span className="text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shadow-sm inline-block">Draft</span>}
        </td>
        {/* Zoho Sync */}
        {visibleColumns.has('zoho') && (
          <td style={{ minWidth: 110, width: 110 }} className="px-4 py-3 align-middle text-left whitespace-nowrap text-sm text-gray-400">
            —
          </td>
        )}
        {/* Inventory */}
        {visibleColumns.has('inventory') && (
          <td style={{ minWidth: 90, width: 90 }} className="px-4 py-3 align-middle text-center">
            <input 
              type="checkbox" 
              checked={formData.trackInventory} 
              onChange={e => setFormData({ ...formData, trackInventory: e.target.checked })} 
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
            />
          </td>
        )}
        {/* Updated At */}
        {visibleColumns.has('updatedAt') && (
          <td style={{ minWidth: 120, width: 120 }} className="px-4 py-3 align-middle text-sm text-gray-400">
            —
          </td>
        )}
        {/* Actions */}
        <td style={{ minWidth: 120, width: 120, position: 'sticky', right: 0, zIndex: 10, borderLeft: '1px solid #E5E7EB' }} className={`px-4 py-3 align-middle text-right ${stickyBg}`}>
          <div className="flex justify-end gap-1.5">
            <button onClick={handleCancelInline} disabled={isSubmitting} className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg border border-transparent hover:border-red-200 bg-white/50 hover:bg-red-50 disabled:opacity-50 transition-all flex items-center justify-center shadow-sm" title="Cancel">
              <X size={16} />
            </button>
            <button onClick={handleSaveInline} disabled={isSubmitting} className="text-white p-1.5 rounded-lg border border-transparent bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center font-medium" title="Save Row">
              <Check size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else {
        setSortConfig(null);
        return;
      }
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity inline-block" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="ml-1 text-indigo-600 inline-block" /> : <ArrowDown size={12} className="ml-1 text-indigo-600 inline-block" />;
  };

  // Derived state for table
  const filteredProducts = (product?.variantProducts || [])
    .filter((child: any) => {
      // Visibility Filter
      if (visibilityMode === 'active' && child.status === 'Inactive') return false;
      return true;
    })
    .filter((child: any) => {
      // Search Filter
      if (!productSearch) return true;
      const s = productSearch.toLowerCase();
      return child.name.toLowerCase().includes(s) || child.code.toLowerCase().includes(s);
    })
    .sort((a: any, b: any) => {
      // Sort Filter
      if (!sortConfig) return 0;
      
      let valA: any = '';
      let valB: any = '';
      
      if (sortConfig.key === 'purchasePrice') {
        valA = a.variants?.[0]?.purchasePrice || 0;
        valB = b.variants?.[0]?.purchasePrice || 0;
      } else if (sortConfig.key === 'sellingPrice') {
        valA = a.variants?.[0]?.sellingPrice || 0;
        valB = b.variants?.[0]?.sellingPrice || 0;
      } else if (sortConfig.key === 'status') {
        valA = a.status || '';
        valB = b.status || '';
      } else if (sortConfig.key.startsWith('attr_')) {
        const attrId = sortConfig.key.replace('attr_', '');
        valA = a.attributeValues?.find((av: any) => av.attributeId === attrId)?.value || '';
        valB = b.attributeValues?.find((av: any) => av.attributeId === attrId)?.value || '';
      }
      
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

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
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">        {/* HORIZONTAL CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* FAMILY SUMMARY */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <Activity size={16} className="text-indigo-600 mr-2" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Family Summary</h2>
            </div>
            <div className="p-0 flex-1">
              {(() => {
                const total = product?.variantProducts?.length || 0;
                const active = product?.variantProducts?.filter((c: any) => c.status === 'Active').length || 0;
                const inactive = total - active;
                const synced = product?.variantProducts?.filter((c: any) => c.variants?.[0]?.zohoSyncStatus === 'SYNCED').length || 0;
                const failed = product?.variantProducts?.filter((c: any) => c.variants?.[0]?.zohoSyncStatus === 'SYNC_FAILED').length || 0;
                const notSynced = total - synced - failed;
                return (
                  <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 h-full">
                    <div className="p-4 flex flex-col justify-center">
                      <p className="text-xs text-gray-500 font-medium mb-1">Total Products</p>
                      <p className="text-lg font-semibold text-gray-900">{total}</p>
                    </div>
                    <div className="p-4 flex flex-col justify-center">
                      <p className="text-xs text-gray-500 font-medium mb-1">Active / Inactive</p>
                      <p className="text-lg font-semibold"><span className="text-green-600">{active}</span> <span className="text-gray-300 font-normal">/</span> <span className="text-gray-500">{inactive}</span></p>
                    </div>
                    <div className="p-4 flex flex-col justify-center">
                      <p className="text-xs text-gray-500 font-medium mb-1">Zoho Sync Status</p>
                      <p className="text-lg font-semibold"><span className="text-green-600" title="Synced">{synced}</span> <span className="text-gray-300 font-normal">/</span> <span className="text-yellow-500" title="Pending">{notSynced}</span> <span className="text-gray-300 font-normal">/</span> <span className="text-red-600" title="Failed">{failed}</span></p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Synced / Pending / Failed</p>
                    </div>
                    <div className="p-4 flex flex-col justify-center">
                      <p className="text-xs text-gray-500 font-medium mb-1">Total Inventory</p>
                      <p className="text-lg text-gray-400 font-medium">N/A</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* FAMILY DETAILS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <Layers size={16} className="text-gray-500 mr-2" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Family Details</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 flex-1">
              <div><p className="text-xs font-medium text-gray-500">Category</p><p className="mt-1 text-sm text-gray-900">{product.category?.name || '—'}</p></div>
              <div><p className="text-xs font-medium text-gray-500">Brand</p><p className="mt-1 text-sm text-gray-900">{product.brand?.name || '—'}</p></div>
              <div><p className="text-xs font-medium text-gray-500">Manufacturer</p><p className="mt-1 text-sm text-gray-900">{product.manufacturer?.name || '—'}</p></div>
              <div>
                <p className="text-xs font-medium text-gray-500">Incentive Category</p>
                <div className="mt-1">
                  {product.incentiveTag ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                      {product.incentiveTag}
                    </span>
                  ) : <span className="text-sm text-gray-500">—</span>}
                </div>
              </div>
            </div>
          </div>

          {/* TAX & LOGISTICS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <FileText size={16} className="text-gray-500 mr-2" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Tax & Logistics</h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 flex-1">
              <div><p className="text-xs font-medium text-gray-500">HSN Code</p><p className="mt-1 text-sm text-gray-900">{product.hsnCode?.code || 'Not Assigned'}</p></div>
              <div><p className="text-xs font-medium text-gray-500">GST Rate</p><p className="mt-1 text-sm text-gray-900">{product.taxRate ? `${product.taxRate.percentage}%` : 'Not Assigned'}</p></div>
              <div><p className="text-xs font-medium text-gray-500">Unit of Measurement</p><p className="mt-1 text-sm text-gray-900">{product.unit ? (product.unit.name || product.unit.abbreviation) : 'Not Assigned'}</p></div>
            </div>
          </div>
        </div>

        {/* PRODUCTS TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col relative mb-6">
          <div className="px-4 py-2 border-b border-gray-200 bg-white flex flex-row flex-nowrap overflow-x-auto items-center justify-between gap-4 sticky top-0 z-20">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={14} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by Name / SKU"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-3 py-1 border border-gray-300 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500 w-64 outline-none"
              />
            </div>
            <div className="flex gap-2 flex-shrink-0 items-center">
              <button onClick={() => setIsImportModalOpen(true)} disabled={!isActive} className={`px-2.5 py-1 font-medium rounded-md text-xs flex items-center shadow-sm transition-all ${isActive ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                <Box size={14} className="mr-1.5" /> Import
              </button>
              <button onClick={startAddVariant} disabled={!isActive || isAddingVariant || editingVariantId !== null} className={`px-2.5 py-1 font-medium rounded-md text-xs flex items-center shadow-sm transition-all ${isActive && !isAddingVariant && !editingVariantId ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'}`}>
                <Plus size={14} className="mr-1.5" /> Create
              </button>
              <div className="relative" ref={colDropdownRef}>
                <button onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm flex items-center text-xs">
                  <Columns size={14} className="mr-1.5" /> Columns <ChevronDown size={14} className="ml-1" />
                </button>
                {isColumnSelectorOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-2">
                    {['zoho', 'inventory', 'updatedAt'].map(col => (
                      <label key={col} className="flex items-center px-4 py-1.5 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col)}
                          onChange={() => {
                            const newSet = new Set(visibleColumns);
                            if (newSet.has(col)) newSet.delete(col);
                            else newSet.add(col);
                            setVisibleColumns(newSet);
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 mr-3"
                        />
                        <span className="text-xs text-gray-700">{col === 'zoho' ? 'Zoho Sync Status' : col === 'updatedAt' ? 'Updated At' : 'Inventory'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => {}} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm flex items-center text-xs">
                <Download size={14} className="mr-1.5" /> Export
              </button>
              <button onClick={() => fetchProduct()} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm flex items-center text-xs">
                <RefreshCw size={14} className="mr-1.5" /> Refresh
              </button>

              <div className="h-5 w-px bg-gray-200 mx-1"></div>

              {/* Show Inactive Toggle */}
              <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200">
                <button 
                  onClick={() => { setVisibilityMode('active'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${visibilityMode === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Active Only
                </button>
                <button 
                  onClick={() => { setVisibilityMode('all'); setCurrentPage(1); }}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${visibilityMode === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  All Products
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto w-full relative" style={{ maxWidth: '100vw' }}>
            <table className="min-w-max w-full divide-y divide-gray-200 border-b border-gray-200">
              <thead className="bg-gray-50/90 backdrop-blur-sm shadow-sm sticky top-0 z-20">
                <tr>
                  <th style={{ minWidth: 40, width: 40, position: 'sticky', left: 0, zIndex: 30 }} className="px-2 py-2 text-center text-[11px] font-semibold text-gray-700 bg-gray-50">
                    #
                  </th>
                  <th style={{ minWidth: 48, width: 48, position: 'sticky', left: 40, zIndex: 30 }} className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 bg-gray-50">
                    <ImageIcon size={14} className="mx-auto text-gray-400" />
                  </th>
                  <th style={{ minWidth: 260, width: 260, position: 'sticky', left: 88, zIndex: 30, borderRight: '1px solid #E5E7EB' }} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                    Product Name
                  </th>
                  <th style={{ minWidth: 140, width: 140, position: 'sticky', left: 348, zIndex: 30, borderRight: '1px solid #E5E7EB' }} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                    SKU
                  </th>
                  {attributes.map(attr => (
                    <th key={attr.id} style={{ minWidth: 140, width: 140 }} onClick={() => requestSort(`attr_${attr.id}`)} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap group cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center">
                        {attr.attributeName} {attr.mandatory && <span className="text-red-500">*</span>}
                        {renderSortIcon(`attr_${attr.id}`)}
                      </div>
                    </th>
                  ))}
                  <th style={{ minWidth: 120, width: 120 }} onClick={() => requestSort('purchasePrice')} className="px-3 py-2 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wider group cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-end">
                      Purchase Price
                      {renderSortIcon('purchasePrice')}
                    </div>
                  </th>
                  <th style={{ minWidth: 120, width: 120 }} onClick={() => requestSort('sellingPrice')} className="px-3 py-2 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wider group cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-end">
                      Selling Price
                      {renderSortIcon('sellingPrice')}
                    </div>
                  </th>
                  <th style={{ minWidth: 120, width: 120 }} onClick={() => requestSort('status')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider group cursor-pointer hover:bg-gray-100 transition-colors">
                    <div className="flex items-center">
                      Status
                      {renderSortIcon('status')}
                    </div>
                  </th>
                  {visibleColumns.has('zoho') && (
                    <th style={{ minWidth: 90, width: 90 }} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                      Zoho Sync
                    </th>
                  )}
                  {visibleColumns.has('inventory') && (
                    <th style={{ minWidth: 80, width: 80 }} className="px-3 py-2 text-center text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                      Inventory
                    </th>
                  )}
                  {visibleColumns.has('updatedAt') && (
                    <th style={{ minWidth: 100, width: 100 }} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                      Updated At
                    </th>
                  )}
                  <th style={{ minWidth: 100, width: 100, position: 'sticky', right: 0, zIndex: 30, borderLeft: '1px solid #E5E7EB' }} className="px-3 py-2 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wider bg-gray-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isAddingVariant && renderInlineRow(true, null, paginatedProducts.length + 1)}
                {paginatedProducts.map((child: any, idx: number) => {
                  const absoluteIndex = (currentPage - 1) * rowsPerPage + idx + 1;
                  
                  if (editingVariantId === child.id) {
                    return React.cloneElement(renderInlineRow(true, child, absoluteIndex), { key: child.id });
                  }
                  
                  const isInactive = child.status === 'Inactive';
                  const trClasses = isInactive 
                    ? "bg-red-50/50 hover:bg-red-50/80 transition-colors group"
                    : "bg-white hover:bg-gray-50/80 transition-colors group";
                  const stickyClasses = isInactive 
                    ? "bg-red-50/50 group-hover:bg-red-50/80 transition-colors"
                    : "bg-white group-hover:bg-gray-50/80 transition-colors";
                  
                  return (
                    <tr key={child.id} className={trClasses}>
                      {/* Index */}
                      <td style={{ minWidth: 40, width: 40, position: 'sticky', left: 0, zIndex: 10 }} className={`px-2 py-2 text-center text-xs font-medium text-gray-500 ${stickyClasses}`}>
                        {absoluteIndex}
                      </td>
                      {/* Thumbnail */}
                      <td style={{ minWidth: 48, width: 48, position: 'sticky', left: 40, zIndex: 10 }} className={`px-3 py-2 text-center ${stickyClasses}`}>
                        {product.thumbnailBase64 ? (
                          <img src={product.thumbnailBase64} alt={product.name} className="w-7 h-7 object-cover rounded-md border border-gray-200 shadow-sm mx-auto" />
                        ) : (
                          <div className="w-7 h-7 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center mx-auto text-gray-400">
                            <ImageIcon size={12} />
                          </div>
                        )}
                      </td>
                      {/* Product Name */}
                      <td style={{ minWidth: 260, width: 260, position: 'sticky', left: 88, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className={`px-3 py-2 text-xs font-medium text-gray-900 ${stickyClasses}`}>
                        <div className="line-clamp-2" title={child.name}>{child.name}</div>
                      </td>
                      {/* SKU */}
                      <td style={{ minWidth: 140, width: 140, position: 'sticky', left: 348, zIndex: 10, borderRight: '1px solid #E5E7EB' }} className={`px-3 py-2 text-xs text-gray-600 font-mono ${stickyClasses}`}>
                        <span className="bg-gray-100/80 border border-gray-200 px-1.5 py-0.5 rounded">{child.code}</span>
                      </td>
                      
                      {/* Dynamic Attributes */}
                      {attributes.map(attr => {
                        const val = child.attributeValues?.find((a: any) => a.attributeId === attr.id)?.value;
                        return (
                          <td key={attr.id} style={{ minWidth: 140, width: 140 }} className="px-3 py-2 text-xs text-gray-600 truncate">
                            <AttributeValuePill value={val} />
                          </td>
                        );
                      })}
                      
                      <td style={{ minWidth: 120, width: 120 }} className="px-3 py-2 text-xs text-gray-600 text-right">
                        ₹{child.variants?.[0]?.purchasePrice?.toFixed(2) || '—'}
                      </td>
                      <td style={{ minWidth: 120, width: 120 }} className="px-3 py-2 text-xs text-gray-600 text-right">
                        ₹{child.variants?.[0]?.sellingPrice?.toFixed(2) || '—'}
                      </td>
                      <td style={{ minWidth: 120, width: 120 }} className="px-3 py-2 whitespace-nowrap text-xs">
                        <MasterStatusBadge status={child.status} />
                      </td>
                      {visibleColumns.has('zoho') && (
                        <td style={{ minWidth: 90, width: 90 }} className="px-3 py-2 text-left whitespace-nowrap text-xs">
                          {(() => {
                            const status = child.variants?.[0]?.zohoSyncStatus;
                            if (status === 'SYNCED') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800"><CheckCircle2 size={10} className="mr-1" /> Synced</span>;
                            if (status === 'PENDING') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800"><Clock size={10} className="mr-1" /> Pending</span>;
                            if (status === 'FAILED') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800"><ShieldAlert size={10} className="mr-1" /> Failed</span>;
                            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">Never</span>;
                          })()}
                        </td>
                      )}
                      {visibleColumns.has('inventory') && (
                        <td style={{ minWidth: 80, width: 80 }} className="px-3 py-2 text-center text-xs">
                          {child.variants?.[0]?.trackInventory ? <CheckCircle2 size={14} className="text-green-500 mx-auto" /> : <X size={14} className="text-gray-300 mx-auto" />}
                        </td>
                      )}
                      {visibleColumns.has('updatedAt') && (
                        <td style={{ minWidth: 100, width: 100 }} className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {new Date(child.updatedAt).toLocaleDateString()}
                        </td>
                      )}
                      <td style={{ minWidth: 100, width: 100, position: 'sticky', right: 0, zIndex: 10, borderLeft: '1px solid #E5E7EB' }} className={`px-3 py-2 whitespace-nowrap text-right ${stickyClasses}`}>
                        <div className="flex justify-end gap-1">
                          {child.status === 'Draft' || child.status === 'Declined' ? (
                            <>
                              <button onClick={() => startEditVariant(child)} disabled={isAddingVariant || editingVariantId !== null} className={`p-1 text-gray-500 hover:text-indigo-600 rounded-md transition-colors ${isAddingVariant || editingVariantId !== null ? 'opacity-50 cursor-not-allowed' : ''}`} title="Edit Variant">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleVariantAction(child.id, 'submit')} disabled={isSubmitting || isAddingVariant || editingVariantId !== null} className="p-1 text-gray-500 hover:text-green-600 rounded-md transition-colors" title="Submit For Approval">
                                <CheckCircle2 size={14} />
                              </button>
                              <button onClick={() => handleVariantAction(child.id, 'delete')} disabled={isSubmitting || isAddingVariant || editingVariantId !== null} className="p-1 text-gray-500 hover:text-red-600 rounded-md transition-colors" title="Delete Variant">
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : child.status === 'Approval Pending' ? (
                            <>
                              {canApprove && (
                                <>
                                  <button onClick={() => handleVariantAction(child.id, 'approve')} disabled={isSubmitting} className="p-1 text-gray-500 hover:text-green-600 rounded-md transition-colors" title="Approve">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={() => handleVariantAction(child.id, 'decline')} disabled={isSubmitting} className="p-1 text-gray-500 hover:text-red-600 rounded-md transition-colors" title="Decline">
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                              <button onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${child.id}`)} className="p-1 text-gray-500 hover:text-blue-600 rounded-md transition-colors" title="View Variant">
                                <ExternalLink size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditVariant(child)} disabled={isAddingVariant || editingVariantId !== null} className={`p-1 text-gray-500 hover:text-indigo-600 rounded-md transition-colors ${isAddingVariant || editingVariantId !== null ? 'opacity-50 cursor-not-allowed' : ''}`} title="Edit Variant inline">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => router.push(`/staff/dashboard/catalog-pricing/products/${child.id}`)} className="p-1 text-gray-500 hover:text-blue-600 rounded-md transition-colors" title="View Variant details">
                                <ExternalLink size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                

                {!isAddingVariant && paginatedProducts.length === 0 && (
                  <tr>
                    <td colSpan={11 + attributes.length} className="px-6 py-12 text-center bg-gray-50 border-b border-gray-200">
                      <Box size={32} className="mx-auto text-gray-300 mb-2" />
                      <h3 className="text-sm font-medium text-gray-900">{productSearch ? 'No matching products' : 'No products found'}</h3>
                      <p className="mt-1 text-xs text-gray-500">{productSearch ? 'Try a different search term.' : 'Click "Create Variant" to start building your product matrix.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-4 py-2 border-t border-gray-200 bg-white flex items-center justify-between mt-auto">
            <div className="flex items-center text-xs text-gray-500">
              Showing {(currentPage - 1) * rowsPerPage + (paginatedProducts.length > 0 ? 1 : 0)} to {Math.min(currentPage * rowsPerPage, filteredProducts.length)} of {filteredProducts.length} entries
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Rows per page:</span>
              <select 
                value={rowsPerPage} 
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-md text-xs py-1 pl-2 pr-6 bg-white focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              
              <div className="flex space-x-1 ml-3 border-l pl-3 border-gray-200">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  Prev
                </button>
                <div className="px-2 py-1 text-xs font-medium text-gray-700">
                  {currentPage} / {totalPages}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ACTIVITY TIMELINE */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
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

          {/* PARENT PRODUCT IMAGE */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
              <ImageIcon size={16} className="text-gray-500 mr-2" />
              <h3 className="text-base font-semibold text-gray-900">Parent Product Image</h3>
            </div>
            <div 
              className="p-6 flex flex-col items-center justify-center flex-1 text-center"
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
                <div className="relative group w-48 h-48 rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-4">
                  <img src={resolveProductImage(product) || ''} alt="Product Thumbnail" className="w-full h-full object-cover" />
                  {canEdit && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors"
                        title="Replace Image"
                      >
                        <UploadCloud size={20} />
                      </button>
                      <button 
                        onClick={handleRemoveImage}
                        className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors"
                        title="Delete Image"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center mb-4 transition-colors hover:bg-gray-100 hover:border-indigo-400">
                  <ImageIcon size={32} className="text-gray-400 mb-2" />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canEdit}
                    className="text-sm font-medium text-indigo-600 disabled:opacity-50"
                  >
                    Click to upload
                  </button>
                  <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2 max-w-[200px] leading-snug">
                This image is shared across all variant products.
              </p>
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
