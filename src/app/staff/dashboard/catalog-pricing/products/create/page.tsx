'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ProductStepForm, { Step } from '../_components/ProductStepForm';
import AsyncLookupField from '../_components/AsyncLookupField';
import {
  Package,
  Layers,
  Info,
  Receipt,
  Boxes,
  Wand2,
  Folder,
  FolderOpen,
  FileText,
  Loader2,
  BarChart2,
  Check,
} from 'lucide-react';

const STEPS: Step[] = [
  { id: 'type',      title: 'Product Type' },
  { id: 'details',   title: 'Product Details' },
  { id: 'pricing',   title: 'Tax & Pricing' },
  { id: 'inventory', title: 'Inventory & Review' },
];

// ─── Label helpers ────────────────────────────────────────────────────────────
// These tell AsyncLookupField what text to show for a selected value —
// both in the trigger button and inside the dropdown list.

const hsnDisplay = (opt: any): string => opt.code || opt.id;

const taxDisplay = (opt: any): string => opt.name || opt.id;

const uomDisplay = (opt: any): string =>
  opt.abbreviation ? `${opt.name} (${opt.abbreviation})` : opt.name || opt.id;

const brandDisplay   = (opt: any): string => opt.name || opt.id;
const catDisplay     = (opt: any): string => opt.name || opt.id;
const mfrDisplay     = (opt: any): string => opt.name || opt.id;

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateProductPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep]       = useState(0);
  const [isSaving, setIsSaving]             = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [productType, setProductType]       = useState<'single' | 'variant'>('single');

  const [showErrors, setShowErrors] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Goods',
    name:           '',
    code:           '',
    description:    '',
    remarks:        '',
    brandId:        '',
    manufacturerId: '',
    categoryId:     '',
    hsnCodeId:      '',
    taxRateId:      '',
    unitId:         '',
    purchasePrice:  0,
    sellingPrice:   0,
    trackInventory: true,
    trackSerials:   false,
    incentiveTag:   '',
  });

  const updateForm = (key: keyof typeof formData, value: any) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  // ─── Generate SKU ────────────────────────────────────────────────────────
  const handleGenerateSku = async () => {
    setIsGeneratingSku(true);
    try {
      const res  = await fetch('/api/staff/catalog/products/generate-sku');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate SKU');
      updateForm('code', data.sku);
      toast.success(`SKU generated: ${data.sku}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsGeneratingSku(false);
    }
  };

  // ─── Step validation before advancing ───────────────────────────────────
  const handleNextStep = () => {
    setShowErrors(true);
    
    if (currentStep === 0 && productType !== 'single') {
      return;
    }
    
    if (currentStep === 1) {
      if (!formData.name.trim() || !formData.categoryId || !formData.type) {
        return;
      }
    }
    
    if (currentStep === 2) {
      if (!formData.incentiveTag) {
        return;
      }
    }
    
    setShowErrors(false);
    setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1));
  };

  // ─── Profit Analytics & Incentive Tag Auto-calculation ─────────────────
  const { purchasePrice, sellingPrice } = formData;
  const grossProfit = sellingPrice - purchasePrice;
  const markup = purchasePrice > 0 ? (grossProfit / purchasePrice) * 100 : 0;
  const margin = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  useEffect(() => {
    if (purchasePrice > 0 && sellingPrice > 0) {
      let suggested = '';
      if (margin >= 30) suggested = 'High Margin Product';
      else if (margin >= 15) suggested = 'Medium Margin Product';
      else suggested = 'Low Margin Product';
      
      setFormData(prev => ({ ...prev, incentiveTag: suggested }));
    }
  }, [purchasePrice, sellingPrice, margin]);

  // ─── HSN Helper Logic ──────────────────────────────────────────────────
  const [hsnHelper, setHsnHelper] = useState<any>(null);
  const [loadingHsnHelper, setLoadingHsnHelper] = useState(false);

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (submitForApproval: boolean) => {
    setShowErrors(true);
    if (!formData.name.trim() || !formData.categoryId || !formData.type) {
      toast.error('Please fill in all mandatory fields');
      setCurrentStep(1);
      return;
    }

    setIsSaving(true);
    try {
      const res  = await fetch('/api/staff/catalog/products', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...formData, submitForApproval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');

      toast.success(submitForApproval ? 'Product submitted for approval!' : 'Product saved as draft!');
      router.push(`/staff/dashboard/catalog-pricing/products/${data.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <ProductStepForm
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      onNextStep={handleNextStep}
      onSaveDraft={() => handleSave(false)}
      onSubmitApproval={() => handleSave(true)}
      isSaving={isSaving}
    >

      {/* ══════════════════════════════════════════════════
          STEP 1 — Select Product Type
      ══════════════════════════════════════════════════ */}
      {currentStep === 0 && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-2">
            <h2 className="text-[15px] font-semibold text-gray-900">Select Product Type</h2>
            <p className="text-[13px] text-gray-500 mt-0.5">Choose the kind of product you're creating.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Single Product */}
            <div
              onClick={() => setProductType('single')}
              className={`group flex items-start gap-4 p-4 rounded-xl border-[1.5px] cursor-pointer transition-all duration-200 ${
                productType === 'single'
                  ? 'border-blue-600 bg-blue-50/30 shadow-[0_2px_8px_rgba(37,99,235,0.12)]'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white'
              }`}
            >
              <div className={`p-3 rounded-xl flex-shrink-0 transition-colors duration-200 ${
                productType === 'single' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
              }`}>
                <Package size={24} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-[14px] font-semibold ${productType === 'single' ? 'text-blue-900' : 'text-gray-900'}`}>Single Product</h3>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    productType === 'single' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}>
                    {productType === 'single' && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                </div>
                <p className="text-[12.5px] text-gray-500 leading-snug">
                  One standalone inventory item with unique pricing.
                </p>
              </div>
            </div>

            {/* Variant Product — Coming Soon */}
            <div
              className="flex items-start gap-4 p-4 rounded-xl border-[1.5px] border-gray-100 bg-gray-50/50 cursor-not-allowed"
              title="Variant Products will be available in Phase 2."
            >
              <div className="p-3 rounded-xl flex-shrink-0 bg-gray-200/50 text-gray-400">
                <Layers size={24} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[14px] font-semibold text-gray-500">Variant Product</h3>
                  <span className="text-[10px] font-medium bg-gray-200/60 text-gray-500 px-2 py-0.5 rounded-full tracking-wide">
                    COMING SOON
                  </span>
                </div>
                <p className="text-[12.5px] text-gray-400 leading-snug">
                  A product family with multiple variants (Size, Color).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 2 — Product Details
      ══════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 pb-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Info size={18} /></div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Product Details</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Name, category, brand, and description.</p>
            </div>
          </div>

          <div className="bg-[#FAFBFC] rounded-xl border border-gray-100 p-6 space-y-6">
            
            {/* Section: Basic Information */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Basic Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Product Name — required */}
                <div className="col-span-2">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm ${showErrors && !formData.name.trim() ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}`}
                    placeholder="e.g., Luminous Inverter 1000VA"
                    value={formData.name}
                    onChange={e => updateForm('name', e.target.value)}
                  />
                </div>

                {/* Product Type (Goods/Service) */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${formData.type === 'Goods' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" name="productType" value="Goods" checked={formData.type === 'Goods'} onChange={() => updateForm('type', 'Goods')} className="hidden" />
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${formData.type === 'Goods' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {formData.type === 'Goods' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      Goods
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${formData.type === 'Service' ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                      <input type="radio" name="productType" value="Service" checked={formData.type === 'Service'} onChange={() => updateForm('type', 'Service')} className="hidden" />
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${formData.type === 'Service' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {formData.type === 'Service' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      Service
                    </label>
                  </div>
                </div>

                

                {/* SKU / Product Code */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
                    SKU <span className="text-gray-400 font-normal">— auto-generates if empty</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      className="w-full pl-3 pr-24 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm uppercase font-mono tracking-wider"
                      placeholder="e.g., A9K2P1"
                      value={formData.code}
                      onChange={e => updateForm('code', e.target.value.toUpperCase())}
                      maxLength={20}
                    />
                    <div className="absolute right-1">
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        disabled={isGeneratingSku}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-40"
                      >
                        {isGeneratingSku ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-200/60" />

            {/* Section: Classification */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Classification</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Category — required */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Category"
                    required
                    endpoint="/api/staff/catalog/categories"
                    extraQueryParams={{ sortBy: 'name' }}
                    value={formData.categoryId}
                    onChange={val => updateForm('categoryId', val || '')}
                    displayValue={catDisplay}
                    isOptionDisabled={opt => opt.parentId === null && (opt._count?.children || 0) > 0}
                    renderOption={opt => {
                      const isSub = Boolean(opt.parentId);
                      const isParentWithKids = opt.parentId === null && (opt._count?.children || 0) > 0;
                      if (isSub) return <span className="flex items-center gap-2 pl-4 text-gray-700"><FileText size={12} className="text-gray-400 flex-shrink-0" />{opt.name}</span>;
                      if (isParentWithKids) return <span className="flex items-center gap-2 text-gray-400 font-medium"><Folder size={13} className="text-gray-400 flex-shrink-0" />{opt.name}</span>;
                      return <span className="flex items-center gap-2 text-gray-800 font-medium"><FolderOpen size={13} className="text-blue-500 flex-shrink-0" />{opt.name}</span>;
                    }}
                  />
                </div>

                {/* Brand */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Brand"
                    endpoint="/api/staff/catalog/brands"
                    value={formData.brandId}
                    onChange={val => updateForm('brandId', val || '')}
                    displayValue={brandDisplay}
                    clearable
                  />
                </div>

                {/* Manufacturer */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Manufacturer"
                    endpoint="/api/staff/catalog/manufacturers"
                    value={formData.manufacturerId}
                    onChange={val => updateForm('manufacturerId', val || '')}
                    displayValue={mfrDisplay}
                    clearable
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-200/60" />

            {/* Description */}
            <div>
              <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm resize-none"
                placeholder="Optional — brief product description."
                value={formData.description}
                onChange={e => updateForm('description', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 3 — Tax & Pricing
      ══════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 pb-3 mb-2">
            <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><Receipt size={18} /></div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Tax & Pricing</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">HSN code, GST rate, unit, and default prices. All optional.</p>
            </div>
          </div>

          <div className="bg-[#FAFBFC] rounded-xl border border-gray-100 p-6 space-y-6">
            
            {/* Section: Compliance */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Compliance</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* HSN Code — code only */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="HSN Code"
                    endpoint="/api/staff/catalog/hsn-codes"
                    value={formData.hsnCodeId}
                    onChange={val => {
                      updateForm('hsnCodeId', val || '');
                      setHsnHelper(null);
                    }}
                    displayValue={opt => {
                       if (opt && opt.code && formData.hsnCodeId === opt.id && (!hsnHelper || hsnHelper.cachedCode !== opt.code)) {
                         setLoadingHsnHelper(true);
                         fetch(`/api/staff/catalog/hsn-helper?code=${opt.code}`)
                           .then(r => r.json())
                           .then(d => {
                             if (d.found) setHsnHelper({ ...d.data, cachedCode: opt.code });
                             else setHsnHelper({ notFound: true, cachedCode: opt.code });
                           })
                           .finally(() => setLoadingHsnHelper(false));
                       }
                       return hsnDisplay(opt);
                    }}
                    renderOption={opt => (
                      <span className="flex flex-col">
                        <span className="font-medium font-mono text-gray-800">{opt.code}</span>
                        {opt.name && opt.name !== opt.code && (
                          <span className="text-[11px] text-gray-400 truncate">{opt.name}</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                  
                  {/* HSN Helper Card */}
                  {formData.hsnCodeId && (
                    <div className="mt-2 text-sm">
                      {loadingHsnHelper ? (
                        <div className="animate-pulse bg-gray-100 rounded-lg h-12 w-full"></div>
                      ) : hsnHelper?.notFound ? (
                        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg text-gray-500 text-[12.5px]">
                          No helper information available.
                        </div>
                      ) : hsnHelper && !hsnHelper.notFound ? (
                        <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-lg flex gap-2">
                          <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-blue-900 text-[13px] leading-snug">{hsnHelper.description}</p>
                            <p className="text-blue-600/80 text-[12px] mt-1 font-medium">{hsnHelper.level}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Tax Rate — name only */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Tax Rate (GST)"
                    endpoint="/api/staff/catalog/tax-rates"
                    value={formData.taxRateId}
                    onChange={val => updateForm('taxRateId', val || '')}
                    displayValue={taxDisplay}
                    renderOption={opt => (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">{opt.name}</span>
                        {opt.percentage !== undefined && (
                          <span className="text-[12px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{opt.percentage}%</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                </div>

                {/* Unit of Measurement */}
                <div className="col-span-2 sm:col-span-1">
                  <AsyncLookupField
                    label="Unit of Measurement"
                    endpoint="/api/staff/catalog/units"
                    value={formData.unitId}
                    onChange={val => updateForm('unitId', val || '')}
                    displayValue={uomDisplay}
                    renderOption={opt => (
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-gray-800">{opt.name}</span>
                        {opt.abbreviation && (
                          <span className="text-[12px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{opt.abbreviation}</span>
                        )}
                      </span>
                    )}
                    clearable
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-200/60" />

            {/* Section: Pricing */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Pricing</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Purchase Price */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Purchase Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm"
                      placeholder="0.00"
                      value={formData.purchasePrice || ''}
                      onChange={e => updateForm('purchasePrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Selling Price */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">Selling Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm"
                      placeholder="0.00"
                      value={formData.sellingPrice || ''}
                      onChange={e => updateForm('sellingPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Live Analytics Summary */}
              <div className={`mt-4 p-4 rounded-xl border flex gap-6 transition-colors duration-300 ${grossProfit < 0 ? 'bg-red-50/50 border-red-100' : grossProfit > 0 && margin < 15 ? 'bg-orange-50/50 border-orange-100' : 'bg-green-50/50 border-green-100'}`}>
                <div className="flex-1">
                  <p className="text-[12px] text-gray-500 font-medium uppercase tracking-wider mb-1">Gross Profit</p>
                  <p className={`text-lg font-bold ${grossProfit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    ₹{grossProfit.toFixed(2)}
                  </p>
                </div>
                <div className="flex-1 border-l border-gray-200/50 pl-6">
                  <p className="text-[12px] text-gray-500 font-medium uppercase tracking-wider mb-1">Mark-up</p>
                  <p className="text-lg font-bold text-gray-700">{markup.toFixed(1)}%</p>
                </div>
                <div className="flex-1 border-l border-gray-200/50 pl-6">
                  <p className="text-[12px] text-gray-500 font-medium uppercase tracking-wider mb-1">Margin</p>
                  <p className={`text-lg font-bold ${margin < 15 && margin >= 0 ? 'text-orange-600' : 'text-gray-700'}`}>{margin.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <hr className="border-gray-200/60" />

            {/* Section: Incentive Tag */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Incentive Classification</h3>
              <label className="block text-[13.5px] font-medium text-gray-700 mb-2">
                Incentive Tag <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {['High Margin Product', 'Medium Margin Product', 'Low Margin Product'].map(tag => (
                  <label key={tag} className={`flex-1 flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${formData.incentiveTag === tag ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium shadow-sm' : `border-gray-200 bg-white text-gray-600 hover:border-gray-300 ${showErrors && !formData.incentiveTag ? 'border-red-400' : ''}`}`}>
                    <input type="radio" name="incentiveTag" value={tag} checked={formData.incentiveTag === tag} onChange={() => updateForm('incentiveTag', tag)} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.incentiveTag === tag ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {formData.incentiveTag === tag && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <span className="text-[13px]">{tag}</span>
                  </label>
                ))}
              </div>
              {showErrors && !formData.incentiveTag && <p className="text-red-500 text-xs mt-1.5">Incentive Tag is required</p>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STEP 4 — Inventory & Review
      ══════════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 pb-3 mb-2">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><BarChart2 size={18} /></div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">Inventory & Review</h2>
              <p className="text-[13px] text-gray-500 mt-0.5">Configure tracking behaviour and add an optional note for the approver.</p>
            </div>
          </div>

          <div className="bg-[#FAFBFC] rounded-xl border border-gray-100 p-6 space-y-6">
            
            {/* Section: Tracking */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Tracking</h3>
              <div className="space-y-3">
                {/* Track Inventory */}
                <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${formData.trackInventory ? 'border-blue-200 bg-blue-50/50 shadow-sm' : 'border-gray-200 hover:bg-white hover:border-gray-300 bg-white'}`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                    checked={formData.trackInventory}
                    onChange={e => updateForm('trackInventory', e.target.checked)}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">Track Inventory</p>
                    <p className="text-[13px] text-gray-500 mt-0.5">Maintain stock counts for this product. Disable for unlimited-quantity items.</p>
                  </div>
                </label>

                {/* Track Serials */}
                <label className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${!formData.trackInventory ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' : formData.trackSerials ? 'border-blue-200 bg-blue-50/50 shadow-sm cursor-pointer' : 'border-gray-200 cursor-pointer hover:bg-gray-50 hover:border-gray-300 bg-white'}`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0 disabled:cursor-not-allowed"
                    checked={formData.trackSerials}
                    onChange={e => updateForm('trackSerials', e.target.checked)}
                    disabled={!formData.trackInventory}
                  />
                  <div>
                    <p className="text-[14px] font-medium text-gray-900">Track Serial Numbers</p>
                    <p className="text-[13px] text-gray-500 mt-0.5">Require serial number scanning on dispatch and inwarding. Requires inventory tracking.</p>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-gray-200/60" />

            {/* Section: Review Note */}
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900 mb-4 uppercase tracking-wider">Review</h3>
              <label className="block text-[13.5px] font-medium text-gray-700 mb-1.5">
                Approval Remarks <span className="font-normal text-gray-400">— optional</span>
              </label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 text-[13.5px] border rounded-lg outline-none transition-all duration-200 bg-white border-gray-200 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/10 focus:shadow-sm resize-none"
                placeholder="Leave a note for the approver..."
                value={formData.remarks}
                onChange={e => updateForm('remarks', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

    </ProductStepForm>
  );
}
