'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Archive, Clock, Lock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import MasterStatusBadge from '../../../_framework/MasterStatusBadge';

export default function EditProductAttributePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [record, setRecord] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, any> | null>(null);
  
  const [formData, setFormData] = useState({
    attributeName: '',
    description: '',
    dataType: 'Text',
    mandatory: false,
    minValue: '',
    maxValue: '',
    prefix: '',
    suffix: '',
    placeholder: '',
    status: 'Active',
    options: [] as string[],
    categories: [] as string[]
  });

  const [optionInput, setOptionInput] = useState('');

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          const perms = data.session;
          setPermissions(perms);
            
            // Then fetch attribute data
            Promise.all([
              fetch('/api/staff/catalog/categories?limit=all&status=Active').then(r => r.json()),
              fetch(`/api/staff/catalog/product-attributes/${id}`).then(r => r.json())
            ]).then(([catsData, attrData]) => {
              if (attrData.error) throw new Error(attrData.error);
              
              let fetchedCategories = catsData.records || [];
              const existingMapped = attrData.categories || [];
              
              // Ensure already mapped categories are available in the list, even if inactive
              existingMapped.forEach((mappedCat: any) => {
                if (mappedCat.category && !fetchedCategories.some((c: any) => c.id === mappedCat.categoryId)) {
                  fetchedCategories.push({
                    id: mappedCat.categoryId,
                    name: `${mappedCat.category.name} (Inactive)`
                  });
                }
              });

              setCategories(fetchedCategories);
              setRecord(attrData);
              setFormData({
                attributeName: attrData.attributeName || '',
                description: attrData.description || '',
                dataType: attrData.dataType || 'Text',
                mandatory: attrData.mandatory || false,
                minValue: attrData.minValue !== null ? attrData.minValue.toString() : '',
                maxValue: attrData.maxValue !== null ? attrData.maxValue.toString() : '',
                prefix: attrData.prefix || '',
                suffix: attrData.suffix || '',
                placeholder: attrData.placeholder || '',
                status: attrData.status || 'Active',
                options: attrData.options || [],
                categories: (attrData.categories || []).map((c: any) => c.categoryId)
              });
            }).catch(e => {
              toast.error(e.message || 'Failed to load attribute');
              router.back();
            }).finally(() => setLoading(false));
          }
        }
      )
      .catch(() => toast.error('Failed to check permissions'));
  }, [id, router]);

  const handleSave = async () => {
    if (!formData.attributeName.trim()) return toast.error('Attribute Name is required');
    if (formData.categories.length === 0) return toast.error('Please select at least one category');
    if ((formData.dataType === 'Dropdown' || formData.dataType === 'Multi Select') && formData.options.length === 0) {
      return toast.error('At least one option is required');
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        options: (formData.dataType === 'Dropdown' || formData.dataType === 'Multi Select') ? formData.options : null
      };

      const res = await fetch(`/api/staff/catalog/product-attributes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      
      toast.success('Attribute updated successfully');
      router.push('/staff/dashboard/catalog-pricing/product-attributes');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this attribute?')) return;
    try {
      const res = await fetch(`/api/staff/catalog/product-attributes/${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to archive');
      toast.success('Attribute archived');
      router.push('/staff/dashboard/catalog-pricing/product-attributes');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addOption = () => {
    if (optionInput.trim() && !formData.options.includes(optionInput.trim())) {
      setFormData(prev => ({ ...prev, options: [...prev.options, optionInput.trim()] }));
      setOptionInput('');
    }
  };

  const removeOption = (opt: string) => {
    setFormData(prev => ({ ...prev, options: prev.options.filter(o => o !== opt) }));
  };

  const toggleCategory = (catId: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(catId) 
        ? prev.categories.filter(c => c !== catId)
        : [...prev.categories, catId]
    }));
  };

  if (loading || !permissions) {
    return <div className="p-10 text-center text-gray-500">Loading...</div>;
  }

  const canEdit = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_modify);
  const canArchive = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_archive);

  const isNumeric = formData.dataType === 'Number' || formData.dataType === 'Decimal';
  const isOptions = formData.dataType === 'Dropdown' || formData.dataType === 'Multi Select';
  const isArchived = record?.status === 'Archived';
  const inUse = record?._count?.productValues > 0;

  return (
    <div className="flex flex-col min-h-full bg-[#F6F8FB] pb-20">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-gray-900">{record?.attributeName}</h1>
              {record?.status && <MasterStatusBadge status={record.status} />}
            </div>
            <p className="text-[13px] text-gray-500 mt-1">{record?.attributeCode}</p>
          </div>
        </div>
        {!isArchived && (
          <div className="flex items-center gap-3">
            {canArchive && (
              <button
                onClick={handleArchive}
                className="h-[36px] px-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-2 text-[13px] font-medium transition-colors"
              >
                <Archive size={16} />
                <span>Archive</span>
              </button>
            )}
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-[36px] px-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-medium shadow-sm disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-6 max-w-[1000px] mx-auto w-full grid grid-cols-3 gap-6">
        
        {inUse && (
          <div className="col-span-3 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-amber-800 font-semibold text-[14px]">Attribute is in use</h3>
              <p className="text-amber-700 text-[13px] mt-1">This attribute is currently mapped to existing products. Structural properties like Data Type and existing Category mappings are locked to protect product data integrity.</p>
            </div>
          </div>
        )}

        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Basic Information</h2>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Attribute Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.attributeName}
                  onChange={e => setFormData({...formData, attributeName: e.target.value})}
                  disabled={isArchived || !canEdit}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700 mb-1.5">
                  Data Type {inUse && <Lock size={12} className="text-gray-400" />}
                </label>
                <select 
                  value={formData.dataType}
                  onChange={e => setFormData({...formData, dataType: e.target.value})}
                  disabled={isArchived || inUse}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                >
                  {['Text', 'Long Text', 'Number', 'Decimal', 'Dropdown', 'Multi Select', 'Boolean', 'Date'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {inUse && <p className="text-[11px] text-amber-600 mt-1">Data type locked (in use)</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  disabled={isArchived}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Validation & Options</h2>
            <div className="grid grid-cols-2 gap-5">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="mandatory"
                  checked={formData.mandatory}
                  onChange={e => setFormData({...formData, mandatory: e.target.checked})}
                  disabled={isArchived}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <label htmlFor="mandatory" className="text-[13px] font-medium text-gray-700">Mandatory Field</label>
              </div>
              <div></div>

              {isNumeric && (
                <>
                  <div>
                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Minimum Value</label>
                    <input type="number" value={formData.minValue} onChange={e => setFormData({...formData, minValue: e.target.value})} disabled={isArchived} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Maximum Value</label>
                    <input type="number" value={formData.maxValue} onChange={e => setFormData({...formData, maxValue: e.target.value})} disabled={isArchived} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px]" />
                  </div>
                </>
              )}

              {isOptions && (
                <div className="col-span-2">
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Options</label>
                  {!isArchived && (
                    <div className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        value={optionInput}
                        onChange={e => setOptionInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-[13px]"
                      />
                      <button onClick={addOption} type="button" className="px-4 bg-gray-100 rounded-lg text-[13px] font-medium">Add</button>
                    </div>
                  )}
                  {formData.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                      {formData.options.map((opt, i) => {
                        const isOriginalOpt = record?.options?.includes(opt);
                        const disableDelete = inUse && isOriginalOpt;
                        return (
                          <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-[12px] font-medium text-gray-700 shadow-sm">
                            {opt}
                            {!isArchived && !disableDelete && <button onClick={() => removeOption(opt)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>}
                            {!isArchived && disableDelete && <Lock size={10} className="text-gray-300 ml-1" aria-label="Option locked (in use)" />}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Prefix</label>
                <input type="text" value={formData.prefix} onChange={e => setFormData({...formData, prefix: e.target.value})} disabled={isArchived} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px]" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Suffix</label>
                <input type="text" value={formData.suffix} onChange={e => setFormData({...formData, suffix: e.target.value})} disabled={isArchived} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Mapped Categories</h2>
            <div className="border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-gray-100">
                {categories.map(cat => {
                  const isOriginalCategory = record?.categories?.some((c: any) => c.categoryId === cat.id);
                  const disableUncheck = inUse && isOriginalCategory;
                  return (
                    <label key={cat.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.categories.includes(cat.id)}
                        onChange={() => {
                          if (formData.categories.includes(cat.id) && disableUncheck) return;
                          toggleCategory(cat.id);
                        }}
                        disabled={isArchived || (formData.categories.includes(cat.id) && disableUncheck)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <span className="text-[13px] font-medium text-gray-700">{cat.name}</span>
                      {disableUncheck && <Lock size={12} className="text-gray-400 ml-auto" aria-label="Mapping locked (in use)" />}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              History Logs
            </h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {record.history?.map((log: any) => (
                <div key={log.id} className="text-[12px]">
                  <p className="font-medium text-gray-800">{log.action}</p>
                  <p className="text-gray-500 mt-0.5">{log.remarks}</p>
                  <p className="text-gray-400 mt-1">By {log.performedBy?.name} • {format(new Date(log.performedAt), 'dd MMM yyyy HH:mm')}</p>
                </div>
              ))}
              {(!record.history || record.history.length === 0) && (
                <p className="text-[12px] text-gray-500">No history available.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
