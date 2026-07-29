'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, RotateCcw, Archive, CheckCircle2, History } from 'lucide-react';
import toast from 'react-hot-toast';
import MasterStatusBadge from '../../_framework/MasterStatusBadge';
import HistoryDrawer from '../../_framework/HistoryDrawer';

export default function ViewProductAttributePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, any> | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data && data.session) {
          setPermissions(data.session);
          
          Promise.all([
            fetch('/api/staff/catalog/categories?limit=all').then(r => r.json()),
            fetch(`/api/staff/catalog/product-attributes/${id}`).then(r => r.json())
          ]).then(([catsData, attrData]) => {
            if (attrData.error) throw new Error(attrData.error);
            setCategories(catsData.records || []);
            setRecord(attrData);
          }).catch(e => {
            toast.error(e.message || 'Failed to load attribute');
            router.back();
          }).finally(() => setLoading(false));
        }
      })
      .catch(() => toast.error('Failed to check permissions'));
  }, [id, router]);

  const toggleStatus = async () => {
    if (!confirm(`Are you sure you want to mark this attribute as ${record.status === 'Active' ? 'Inactive' : 'Active'}?`)) return;
    try {
      const payload = {
        ...record,
        status: record.status === 'Active' ? 'Inactive' : 'Active',
        categories: (record.categories || []).map((c: any) => c.categoryId)
      };
      
      const res = await fetch(`/api/staff/catalog/product-attributes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Status updated successfully');
      setRecord((prev: any) => ({ ...prev, status: prev.status === 'Active' ? 'Inactive' : 'Active' }));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !permissions) {
    return <div className="p-10 text-center text-gray-500">Loading...</div>;
  }

  const canEdit = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_modify);
  const canArchive = Boolean(permissions.role === 'ADMIN' || permissions.catalog_product_attributes_archive);
  
  const isNumeric = record?.dataType === 'Number' || record?.dataType === 'Decimal';
  const isOptions = record?.dataType === 'Dropdown' || record?.dataType === 'Multi Select';
  const isActive = record?.status === 'Active';

  const mappedCatNames = (record?.categories || []).map((c: any) => c.category?.name || c.categoryId);

  return (
    <div className="flex flex-col min-h-screen bg-[#F6F8FB] pb-24">
      {/* Header */}
      <div className="pt-4 px-6 mb-4 max-w-[1200px] mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">{record?.attributeName}</h1>
                  <MasterStatusBadge status={record?.status || 'Inactive'} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-mono text-gray-500">{record?.attributeCode}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">{record?.dataType}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setHistoryOpen(true)}
                className="h-[38px] px-4 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-[13.5px] transition-colors shadow-sm inline-flex items-center gap-2"
              >
                <History size={16} /> History
              </button>
              
              {canArchive && (
                <button
                  onClick={toggleStatus}
                  className={`h-[38px] px-4 rounded-lg flex items-center gap-2 text-[13.5px] font-medium transition-colors shadow-sm ${isActive ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-white border border-green-200 text-green-600 hover:bg-green-50'}`}
                >
                  {isActive ? <Archive size={16} /> : <RotateCcw size={16} />}
                  <span>{isActive ? 'Mark Inactive' : 'Mark Active'}</span>
                </button>
              )}
              
              {canEdit && (
                <button
                  onClick={() => router.push(`/staff/dashboard/catalog-pricing/product-attributes/${id}/edit`)}
                  className="h-[38px] px-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-[13.5px] transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <Pencil size={16} /> Edit Attribute
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5 pb-3 border-b border-gray-100">Basic Information</h2>
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Attribute Name</label>
                <div className="text-[14px] text-gray-900 font-medium">{record?.attributeName}</div>
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Data Type</label>
                <div className="text-[14px] text-gray-900">{record?.dataType}</div>
              </div>
              <div className="col-span-2">
                <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                <div className="text-[14px] text-gray-700">{record?.description || '-'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5 pb-3 border-b border-gray-100">Validation Rules</h2>
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Required Field</label>
                <div className="flex items-center gap-2 mt-1">
                  {record?.mandatory ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      <CheckCircle2 size={14} /> Yes, Mandatory
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                      No, Optional
                    </span>
                  )}
                </div>
              </div>
              {isNumeric && (
                <>
                  <div>
                    <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Min Value</label>
                    <div className="text-[14px] text-gray-900">{record?.minValue !== null ? record.minValue : '-'}</div>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-1 block">Max Value</label>
                    <div className="text-[14px] text-gray-900">{record?.maxValue !== null ? record.maxValue : '-'}</div>
                  </div>
                </>
              )}
              {isOptions && (
                <div className="col-span-2">
                  <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-3 block">Dropdown Options</label>
                  <div className="flex flex-wrap gap-2">
                    {record?.options?.map((opt: string, i: number) => (
                      <span key={i} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-gray-700">
                        {opt}
                      </span>
                    ))}
                    {(!record?.options || record?.options.length === 0) && (
                      <span className="text-sm text-gray-400 italic">No options defined</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5 pb-3 border-b border-gray-100">Category Mapping</h2>
            <div className="space-y-3">
              {mappedCatNames.length > 0 ? (
                mappedCatNames.map((name: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-[13px] font-medium text-gray-700">{name}</span>
                  </div>
                ))
              ) : (
                <div className="text-[13px] text-gray-500 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                  Not mapped to any category
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-[15px] font-semibold text-gray-900 mb-5 pb-3 border-b border-gray-100">System Information</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">Created</label>
                <div className="text-[13px] text-gray-800 font-medium">
                  {record?.createdAt ? new Date(record.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">Last Updated By</label>
                <div className="text-[13px] text-gray-800 font-medium">
                  {record?.updatedBy?.name || 'System'}
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  {record?.updatedAt ? new Date(record.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        record={record}
        config={{ name: 'Product Attribute', apiEndpoint: '/api/staff/catalog/product-attributes' } as any}
      />
    </div>
  );
}
