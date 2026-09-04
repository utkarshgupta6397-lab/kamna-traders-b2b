'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Camera, UploadCloud, Search, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OperationsDispatchClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatch/incoming-queue'); // Re-using incoming queue API
      const json = await res.json();
      if (res.ok && json.success) {
        // Filter orders that are NEW
        const activeOrders = json.data.filter((o: any) => o.status === 'NEW');
        setOrders(activeOrders);
      }
    } catch (e) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpload = async () => {
    if (!file || !selectedOrder) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.success) throw new Error(uploadJson.error || 'Upload failed');
      
      const photoUrl = uploadJson.url;

      // Ensure workflow exists or create it, then complete truck details
      const wfRes = await fetch(`/api/dispatch/incoming-orders/${selectedOrder.id}/workflow/truck-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl })
      });
      const wfJson = await wfRes.json();
      if (!wfRes.ok || !wfJson.success) throw new Error(wfJson.error || 'Workflow update failed');

      toast.success('Truck details saved successfully!');
      setSelectedOrder(null);
      setFile(null);
      fetchOrders(); // Refresh to hide or update status

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading && orders.length === 0) {
    return <div className="flex p-12 justify-center"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
  }

  // Filter based on search
  const filtered = orders.filter(o => 
    (o.salesorderNumber || o.zohoSalesorderId).toLowerCase().includes(search.toLowerCase()) ||
    (o.customerName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white max-w-md mx-auto border-x border-gray-200 shadow-sm relative">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between sticky top-0 z-10">
        <h2 className="font-bold text-gray-900 text-lg">Truck Details</h2>
      </div>
      
      {selectedOrder ? (
        <div className="p-4 flex-1 overflow-y-auto pb-24">
          <button onClick={() => { setSelectedOrder(null); setFile(null); }} className="text-[#1A2766] text-sm font-semibold mb-4">
            ← Back to List
          </button>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="font-bold text-lg">{selectedOrder.salesorderNumber || selectedOrder.zohoSalesorderId}</div>
            <div className="text-gray-600 text-sm mt-1">{selectedOrder.customerName}</div>
          </div>

          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-2">Truck Photo <span className="text-red-500">*</span></h3>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setFile(e.target.files[0]);
                }
              }} 
            />
            
            {!file ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <Camera size={32} className="text-blue-500 mb-2" />
                <span className="font-semibold text-blue-700">Take Photo</span>
                <span className="text-xs text-blue-500 mt-1">or select from gallery</span>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-2 bg-gray-50">
                <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                <div className="mt-2 flex justify-between items-center px-2">
                  <span className="text-xs text-gray-500 truncate">{file.name}</span>
                  <button onClick={() => setFile(null)} className="text-red-500 text-xs font-bold px-2 py-1 bg-red-50 rounded">Remove</button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-[#1A2766] text-white py-3.5 rounded-xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? <><Loader2 className="animate-spin" /> Uploading...</> : 'Save Truck Details'}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search Order or Customer..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2766]"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No active incoming orders found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(o => (
                  <div 
                    key={o.id} 
                    onClick={() => setSelectedOrder(o)}
                    className="p-4 hover:bg-blue-50 cursor-pointer transition-colors active:bg-blue-100"
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-gray-900">{o.salesorderNumber || o.zohoSalesorderId}</div>
                      <div className="text-xs text-gray-500">{new Date(o.receivedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-1">{o.customerName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
