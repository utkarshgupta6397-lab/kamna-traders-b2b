'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Image as ImageIcon, Save, X, FileText, Settings, UploadCloud, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import AsyncLookupField from '../../_components/AsyncLookupField';

const hsnDisplay = (opt: any): string => opt.code || opt.id;
const taxDisplay = (opt: any): string => opt.name || opt.id;
const uomDisplay = (opt: any): string => opt.abbreviation ? `${opt.name} (${opt.abbreviation})` : opt.name || opt.id;
const brandDisplay = (opt: any): string => opt.name || opt.id;
const catDisplay = (opt: any): string => opt.pathName || opt.name || opt.id;
const mfrDisplay = (opt: any): string => opt.name || opt.id;

export default function EditFamilyClient({ product }: { product: any }) {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: product.name || '',
    type: product.type || 'Goods',
    description: product.description || '',
    categoryId: product.categoryId || '',
    brandId: product.brandId || '',
    manufacturerId: product.manufacturerId || '',
    hsnCodeId: product.hsnCodeId || '',
    taxRateId: product.taxRateId || '',
    unitId: product.unitId || '',
    thumbnailBase64: product.thumbnailBase64 || '',
    incentiveTag: product.incentiveTag || '',
  });

  const [initialData] = useState({ ...formData });
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  
  const [showLockWarning, setShowLockWarning] = useState(false);
  
  const childrenCount = product.variantProducts?.length || 0;

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setThumbnailError('Unsupported format. Please use JPEG, PNG, or WEBP.');
      return;
    }
    if (file.size > 500 * 1024) {
      setThumbnailError('File exceeds 500 KB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({ ...prev, thumbnailBase64: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (skipWarning = false) => {
    if (!skipWarning && childrenCount > 0) {
      const sharedFieldsChanged = 
        formData.categoryId !== initialData.categoryId ||
        formData.brandId !== initialData.brandId ||
        formData.manufacturerId !== initialData.manufacturerId ||
        formData.hsnCodeId !== initialData.hsnCodeId ||
        formData.taxRateId !== initialData.taxRateId ||
        formData.unitId !== initialData.unitId ||
        formData.incentiveTag !== initialData.incentiveTag;

      if (sharedFieldsChanged) {
        setShowLockWarning(true);
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, productType: 'variant' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update Product Family');
      
      toast.success('Product Family updated successfully');
      router.push(`/staff/dashboard/catalog-pricing/products/${product.id}`);
    } catch (e: any) {
      toast.error(e.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
      setShowLockWarning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] pb-12 font-inter">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Layers className="text-indigo-600" size={24} />
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Edit Product Family</h1>
                <p className="text-sm text-gray-500 font-mono">ID: {product.code}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button disabled={isSaving} onClick={() => router.back()} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm flex items-center">
                <X size={16} className="mr-2" /> Cancel
              </button>
              <button disabled={isSaving} onClick={() => handleSave(false)} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center disabled:opacity-50">
                {isSaving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span> : <Save size={16} className="mr-2" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
            <FileText size={18} className="mr-2 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Basic Information</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Family Name <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Type <span className="text-red-500">*</span></label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="Goods">Goods</option>
                  <option value="Service">Service</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={4} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors">
                <div className="space-y-1 text-center">
                  {formData.thumbnailBase64 ? (
                    <div className="relative inline-block">
                      <img src={formData.thumbnailBase64} alt="Thumbnail preview" className="h-32 object-contain rounded" />
                      <button type="button" onClick={() => setFormData(p => ({...p, thumbnailBase64: ''}))} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleThumbnailUpload} />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 500KB</p>
                    </>
                  )}
                  {thumbnailError && <p className="text-xs text-red-500 mt-2">{thumbnailError}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Taxonomy & Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
            <Settings size={18} className="mr-2 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Taxonomy & Settings</h2>
          </div>
          <div className="p-6">
            
            {childrenCount > 0 && (
              <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start text-sm border border-blue-100">
                <Info size={18} className="mr-3 flex-shrink-0 mt-0.5" />
                <p>Because this family has <strong>{childrenCount}</strong> products, any changes to these fields will be applied to all child products automatically.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                <AsyncLookupField endpoint="/api/staff/catalog/categories/selectable" value={formData.categoryId} onChange={val => setFormData({ ...formData, categoryId: val })} displayValue={catDisplay} placeholder="Search categories..." label="" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                <AsyncLookupField endpoint="/api/staff/catalog/brands" value={formData.brandId} onChange={val => setFormData({ ...formData, brandId: val })} displayValue={brandDisplay} placeholder="Search brands..." label="" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <AsyncLookupField endpoint="/api/staff/catalog/manufacturers" value={formData.manufacturerId} onChange={val => setFormData({ ...formData, manufacturerId: val })} displayValue={mfrDisplay} placeholder="Search manufacturers..." label="" />
              </div>
              
              <div className="col-span-2"><hr className="border-gray-200 my-2" /></div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code <span className="text-red-500">*</span></label>
                <AsyncLookupField endpoint="/api/staff/catalog/hsn-codes" value={formData.hsnCodeId} onChange={val => setFormData({ ...formData, hsnCodeId: val })} displayValue={hsnDisplay} placeholder="Search HSN codes..." label="" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Tax Rate <span className="text-red-500">*</span></label>
                <AsyncLookupField endpoint="/api/staff/catalog/tax-rates" value={formData.taxRateId} onChange={val => setFormData({ ...formData, taxRateId: val })} displayValue={taxDisplay} placeholder="Select GST rate..." label="" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measurement (UoM) <span className="text-red-500">*</span></label>
                <AsyncLookupField endpoint="/api/staff/catalog/units" value={formData.unitId} onChange={val => setFormData({ ...formData, unitId: val })} displayValue={uomDisplay} placeholder="Select UoM..." label="" />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-3">Incentive Classification</label>
                <div className="flex gap-4">
                  {['High-Margin Product', 'Medium-Margin Product', 'Low-Margin Product'].map(tag => {
                    const isSelected = formData.incentiveTag === tag;
                    return (
                      <label key={tag} className={`flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                        <input type="radio" name="incentiveTag" value={tag} checked={isSelected} onChange={() => setFormData({ ...formData, incentiveTag: tag })} className="hidden" />
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className="text-[13px]">{tag}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showLockWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 font-inter">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Update Product Family</h3>
            <p className="text-sm text-gray-600 mb-6">
              You are modifying shared fields for a Product Family that has {childrenCount} existing products. These changes will cascade to all child products. Do you want to proceed?
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowLockWarning(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleSave(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center">
                {isSaving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span> : null}
                Yes, Update Family
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
