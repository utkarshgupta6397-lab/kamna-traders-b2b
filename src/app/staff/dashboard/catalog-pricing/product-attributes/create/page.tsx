'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateProductAttributePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, any> | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  
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
    // Fetch permissions first
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          const perms = data.session;
          if (perms.role !== 'ADMIN' && !perms.catalog_product_attributes_create) {
            toast.error('Permission Denied');
            router.replace('/staff/dashboard/catalog-pricing/product-attributes');
          } else {
            setPermissions(perms);
            
            // Then fetch categories
            fetch('/api/staff/catalog/categories?limit=all')
              .then(res => res.json())
              .then(data => {
                setCategories(data.records || []);
              })
              .catch(() => toast.error('Failed to load categories'));
          }
        }
      })
      .catch(() => toast.error('Failed to check permissions'));
  }, [router]);

  const handleSave = async () => {
    if (!formData.attributeName.trim()) {
      return toast.error('Attribute Name is required');
    }
    if (formData.categories.length === 0) {
      return toast.error('Please select at least one category');
    }
    if ((formData.dataType === 'Dropdown' || formData.dataType === 'Multi Select') && formData.options.length === 0) {
      return toast.error('At least one option is required for Dropdown/Multi Select');
    }
    if ((formData.dataType === 'Number' || formData.dataType === 'Decimal') && formData.minValue && formData.maxValue) {
      if (parseFloat(formData.minValue) > parseFloat(formData.maxValue)) {
        return toast.error('Minimum Value cannot exceed Maximum Value');
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        options: (formData.dataType === 'Dropdown' || formData.dataType === 'Multi Select') ? formData.options : null
      };

      const res = await fetch('/api/staff/catalog/product-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      
      toast.success('Attribute created successfully');
      router.push('/staff/dashboard/catalog-pricing/product-attributes');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
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

  const toggleCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(id) 
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id]
    }));
  };

  const isNumeric = formData.dataType === 'Number' || formData.dataType === 'Decimal';
  const isOptions = formData.dataType === 'Dropdown' || formData.dataType === 'Multi Select';

  if (!permissions) {
    return <div className="p-10 text-center text-gray-500">Checking permissions...</div>;
  }

  return (
    <div className="flex flex-col min-h-full bg-[#F6F8FB] pb-20">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Create Attribute</h1>
            <p className="text-[13px] text-gray-500 mt-1">Define a new reusable product attribute</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="h-[36px] px-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 text-[13px] font-medium shadow-sm disabled:opacity-50"
          >
            <Save size={16} />
            <span>{loading ? 'Saving...' : 'Save Attribute'}</span>
          </button>
        </div>
      </div>

      <div className="px-6 py-6 max-w-[900px] mx-auto w-full space-y-6">
        
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Basic Information</h2>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Attribute Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={formData.attributeName}
                onChange={e => setFormData({...formData, attributeName: e.target.value})}
                placeholder="e.g., Wattage, Color, Capacity"
                maxLength={100}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Data Type <span className="text-red-500">*</span></label>
              <select 
                value={formData.dataType}
                onChange={e => setFormData({...formData, dataType: e.target.value, minValue: '', maxValue: '', options: []})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                {['Text', 'Long Text', 'Number', 'Decimal', 'Dropdown', 'Multi Select', 'Boolean', 'Date'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Internal notes about this attribute"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Validation & Display */}
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Validation & Display</h2>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="mandatory"
                checked={formData.mandatory}
                onChange={e => setFormData({...formData, mandatory: e.target.checked})}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="mandatory" className="text-[13px] font-medium text-gray-700">Mandatory (Required Field)</label>
            </div>
            <div></div>

            {isNumeric && (
              <>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Minimum Value</label>
                  <input 
                    type="number" 
                    value={formData.minValue}
                    onChange={e => setFormData({...formData, minValue: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Maximum Value</label>
                  <input 
                    type="number" 
                    value={formData.maxValue}
                    onChange={e => setFormData({...formData, maxValue: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </>
            )}

            {isOptions && (
              <div className="col-span-2">
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Options (Press Enter to add)</label>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    placeholder="Type an option..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                  <button onClick={addOption} type="button" className="px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-[13px] font-medium transition-colors">Add</button>
                </div>
                {formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-100 rounded-lg bg-gray-50/50">
                    {formData.options.map((opt, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-[12px] font-medium text-gray-700 shadow-sm">
                        {opt}
                        <button onClick={() => removeOption(opt)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Prefix</label>
              <input 
                type="text" 
                value={formData.prefix}
                onChange={e => setFormData({...formData, prefix: e.target.value})}
                placeholder="e.g., ₹, +91"
                maxLength={15}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Suffix</label>
              <input 
                type="text" 
                value={formData.suffix}
                onChange={e => setFormData({...formData, suffix: e.target.value})}
                placeholder="e.g., W, V, kg"
                maxLength={15}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[13px] font-medium text-gray-700 mb-1.5">Placeholder</label>
              <input 
                type="text" 
                value={formData.placeholder}
                onChange={e => setFormData({...formData, placeholder: e.target.value})}
                placeholder="Hint text shown inside the input"
                maxLength={150}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Category Mapping */}
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-5">Category Mapping <span className="text-red-500">*</span></h2>
          <div className="border border-gray-200 rounded-lg max-h-[300px] overflow-y-auto">
            {categories.length === 0 ? (
              <div className="p-4 text-center text-[13px] text-gray-500">No categories found</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {categories.map(cat => (
                  <label key={cat.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      checked={formData.categories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[13px] font-medium text-gray-700">{cat.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <p className="text-[12px] text-gray-500 mt-2">Select the categories where this attribute should appear during product creation.</p>
        </div>

      </div>
    </div>
  );
}
