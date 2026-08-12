'use client';

import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Download, ExternalLink, Copy, CheckCircle2, ShieldAlert, Edit2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ZohoSyncResultsModal from './ZohoSyncResultsModal';

export default function ZohoBooksVariantPanel({ 
  product, 
  variant, 
  onSuccess,
  canEdit
}: { 
  product: any; 
  variant: any; 
  onSuccess: () => void;
  canEdit?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [fetchId, setFetchId] = useState('');
  const [fetchedItem, setFetchedItem] = useState<any>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncLogData, setSyncLogData] = useState<any>(null);
  
  const [isEditingId, setIsEditingId] = useState(false);
  const [newZohoId, setNewZohoId] = useState(variant?.zohoBookItemId || '');

  useEffect(() => {
    setNewZohoId(variant?.zohoBookItemId || '');
  }, [variant?.zohoBookItemId]);

  const status = variant?.zohoSyncStatus || 'NEVER_SYNCED';
  const isLinked = !!variant?.zohoBookItemId;

  const handleSaveId = async () => {
    if (!newZohoId || !newZohoId.trim()) {
      toast.error('Zoho Books Item ID is required');
      return;
    }
    if (!/^\d+$/.test(newZohoId.trim())) {
      toast.error('Zoho Books Item ID must contain only digits');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/zoho/edit-id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zohoBooksItemId: newZohoId.trim(), variantId: variant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Zoho Books Item ID updated');
      setIsEditingId(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update ID');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/zoho/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSyncLogData(data);
      setSyncModalOpen(true);
      
      if (data.zohoSyncStatus === 'SYNC_FAILED') {
        toast.error('Sync failed. Check logs.');
      } else {
        toast.success('Successfully synced to Zoho Books');
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Failed to sync');
      setSyncLogData({ status: 'FAILED', apiError: e.message || 'Failed to sync', startedAt: new Date().toISOString(), triggerSource: 'MANUAL_SYNC' });
      setSyncModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!fetchId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/zoho/fetch?itemId=${fetchId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFetchedItem(data);
    } catch (e: any) {
      toast.error(e.message || 'Item not found');
      setFetchedItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/zoho/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zohoBooksItemId: fetchId, variantId: variant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Linked to Zoho Books');
      setFetchedItem(null);
      setFetchId('');
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Failed to link');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/zoho/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zohoBooksItemId: variant.zohoBookItemId, variantId: variant?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Product updated from Zoho Books');
      setShowImportConfirm(false);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || 'Failed to import');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLastSync = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/catalog/products/${product.id}/zoho/logs?variantId=${variant?.id}&limit=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.logs && data.logs.length > 0) {
        setSyncLogData(data.logs[0]);
        setSyncModalOpen(true);
      } else {
        toast.error('No sync logs found');
      }
    } catch (e: any) {
      toast.error('Failed to load last sync log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-gray-500" />
          <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide">Zoho Books Integration</h3>
        </div>
        {status === 'SYNCED' && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase border border-emerald-200 flex items-center gap-1"><CheckCircle2 size={10} /> Synced</span>}
        {status === 'SYNC_FAILED' && <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold uppercase border border-red-200 flex items-center gap-1"><ShieldAlert size={10} /> Sync Failed</span>}
        {status === 'SYNCING' && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold uppercase border border-blue-200 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Syncing</span>}
        {status === 'NEVER_SYNCED' && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold uppercase border border-gray-200">Never Synced</span>}
      </div>
      
      <div className="p-4 space-y-4">
        {isLinked ? (
          <>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Zoho Books Item ID</div>
              <div className="flex items-center justify-between">
                {isEditingId ? (
                  <div className="flex gap-2 flex-1 mr-4">
                    <input 
                      type="text" 
                      value={newZohoId}
                      onChange={e => setNewZohoId(e.target.value)}
                      placeholder="Enter new Zoho ID"
                      className="flex-1 h-8 px-2 text-[13px] font-mono border border-blue-400 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <button 
                      onClick={handleSaveId}
                      disabled={loading || !newZohoId.trim() || newZohoId.trim() === variant.zohoBookItemId}
                      className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors"
                      title="Save"
                    >
                      <Save size={14} />
                    </button>
                    <button 
                      onClick={() => { setIsEditingId(false); setNewZohoId(variant.zohoBookItemId); }}
                      disabled={loading}
                      className="h-8 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="text-[13px] font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded border border-gray-200 select-all flex items-center gap-2">
                    {variant.zohoBookItemId}
                    {canEdit && (
                      <button 
                        onClick={() => setIsEditingId(true)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit ID"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(variant.zohoBookItemId); toast.success('Copied to clipboard'); }} className="p-1 text-gray-400 hover:text-gray-700 rounded"><Copy size={14} /></button>
                  <a href={`https://books.zoho.in/app#/inventory/items/${variant.zohoBookItemId}`} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500 hover:text-blue-700 rounded"><ExternalLink size={14} /></a>
                </div>
              </div>
            </div>
            
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Last Sync</div>
              <div className="text-[13px] font-medium text-gray-500">
                {variant.zohoLastSyncAt ? new Date(variant.zohoLastSyncAt).toLocaleString() : 'Never'}
              </div>
            </div>

            {status === 'SYNC_FAILED' && variant.zohoLastSyncError && (
              <div>
                <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12} /> Last Error</div>
                <div className="text-[11px] font-mono text-red-700 bg-red-50 p-2 rounded border border-red-200 break-words whitespace-pre-wrap">
                  {variant.zohoLastSyncError}
                </div>
              </div>
            )}

          </>
        ) : (
          <>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Link Existing Zoho Item</div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={fetchId}
                  onChange={e => setFetchId(e.target.value)}
                  placeholder="Enter Zoho Item ID..."
                  className="flex-1 h-8 px-2 text-[13px] font-mono border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={handleFetch}
                  disabled={loading || !fetchId.trim()}
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Fetch
                </button>
              </div>
            </div>

            {fetchedItem && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[12px] font-bold text-gray-900">{fetchedItem.name}</div>
                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">SKU: {fetchedItem.sku} | Type: {fetchedItem.product_type}</div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${fetchedItem.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800'}`}>
                    {fetchedItem.status}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={handleLink}
                    disabled={loading}
                    className="flex-1 h-7 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Confirm & Link
                  </button>
                  <button 
                    onClick={() => setFetchedItem(null)}
                    disabled={loading}
                    className="h-7 px-3 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 text-[11px] font-semibold rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {!fetchedItem && (
              <div className="text-[11px] text-gray-500 text-center italic mt-2">
                A new item will be created automatically in Zoho Books upon the next Product Save.
              </div>
            )}
          </>
        )}

        <div className="pt-3 border-t border-gray-100 mt-2 space-y-3">
          <div className="flex gap-2">
            <button 
              onClick={handleSyncNow} 
              disabled={loading}
              className="flex-1 h-8 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync with Zoho Books
            </button>
            <button 
              onClick={() => setShowImportConfirm(true)} 
              disabled={loading || !isLinked}
              title={!isLinked ? "Must be linked to import data" : ""}
              className="flex-1 h-8 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download size={14} /> Import From Zoho
            </button>
          </div>
          
          <div className="text-right">
            <button 
              onClick={handleViewLastSync}
              disabled={loading}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
            >
              View Last Sync Details &rarr;
            </button>
          </div>
        </div>
      </div>

      {showImportConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <ShieldAlert size={24} />
              <h3 className="text-lg font-bold">Overwrite ERP Data?</h3>
            </div>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              This action will pull the latest Name, Description, Type, Status, Pricing, and HSN from Zoho Books and <strong>overwrite the current ERP values</strong>.
              <br/><br/>Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowImportConfirm(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />} Yes, Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      <ZohoSyncResultsModal 
        isOpen={syncModalOpen} 
        onClose={() => setSyncModalOpen(false)} 
        logData={syncLogData} 
      />
    </div>
  );
}
